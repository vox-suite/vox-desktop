use crate::track::{TrackWriter, SAMPLE_RATE};
use anyhow::{ensure, Context, Result};
use flexaudio::{AudioChunk, Event, OutputFormat, SourceKind, Stream, StreamConfig};
use serde_json::json;
use std::{
    fs::{File, OpenOptions},
    io::Write,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

pub fn create_private_directory(path: &Path) -> Result<()> {
    let builder = std::fs::DirBuilder::new();
    #[cfg(unix)]
    let builder = {
        use std::os::unix::fs::DirBuilderExt;
        let mut builder = builder;
        builder.mode(0o700);
        builder
    };
    builder
        .create(path)
        .context("choose a new directory under an existing parent")?;
    Ok(())
}

fn create_private_file(path: &Path) -> Result<File> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    Ok(options.open(path)?)
}

pub fn write_json(path: &Path, value: &serde_json::Value) -> Result<()> {
    let mut file = create_private_file(path)?;
    serde_json::to_writer_pretty(&mut file, value)?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    Ok(())
}

struct Lane {
    name: &'static str,
    stream: Stream,
    writer: TrackWriter,
    chunks: u64,
    peak: f32,
    requested_start_ms: u64,
    first_arrival_ns: Option<i64>,
    last_arrival_ns: Option<i64>,
    last_chunk: Instant,
    quality_issues: u64,
}

impl Lane {
    fn open(
        name: &'static str,
        kind: SourceKind,
        device_id: Option<String>,
        output: &Path,
    ) -> Result<Self> {
        let stream = flexaudio::open(StreamConfig {
            kind,
            device_id,
            chunk_ms: 20,
            ring_capacity_chunks: 100,
            output: OutputFormat {
                sample_rate: SAMPLE_RATE,
                channels: 1,
            },
            ..Default::default()
        })
        .with_context(|| {
            format!("cannot open {name} capture; check permissions and selected device")
        })?;
        Ok(Self {
            name,
            stream,
            writer: TrackWriter::create(&output.join(format!("{name}.wav")))?,
            chunks: 0,
            peak: 0.0,
            requested_start_ms: 0,
            first_arrival_ns: None,
            last_arrival_ns: None,
            last_chunk: Instant::now(),
            quality_issues: 0,
        })
    }

    fn accept(&mut self, chunk: AudioChunk, events: &mut File, finalizing: bool) -> Result<()> {
        ensure!(
            chunk.frames == chunk.data.len(),
            "invalid mono chunk length"
        );
        if !chunk.flags.is_empty() || chunk.dropped_before > 0 {
            if !(finalizing
                && chunk.flags == flexaudio::ChunkFlags::PADDED
                && chunk.dropped_before == 0)
            {
                self.quality_issues += 1;
            }
            writeln!(
                events,
                "{}",
                json!({"source": self.name, "frame_index_48k": chunk.frame_index, "flags": format!("{:?}",chunk.flags), "dropped_before": chunk.dropped_before})
            )?;
        }
        self.writer.append(chunk.frame_index, &chunk.data)?;
        self.first_arrival_ns.get_or_insert(chunk.pts_ns);
        self.last_arrival_ns = Some(chunk.pts_ns);
        self.chunks += 1;
        self.peak = self.peak.max(chunk.peak);
        self.last_chunk = Instant::now();
        Ok(())
    }

    fn drain(&mut self, events: &mut File, finalizing: bool) -> Result<()> {
        // Bounded work per lane so one source never starves the other.
        for _ in 0..100 {
            let Some(chunk) = self.stream.poll_chunk() else {
                break;
            };
            self.accept(chunk, events, finalizing)?;
        }
        for _ in 0..100 {
            let Some(event) = self.stream.poll_event() else {
                break;
            };
            writeln!(
                events,
                "{}",
                json!({"source": self.name, "event": format!("{event:?}")})
            )?;
            if matches!(
                event,
                Event::ChunkDropped { .. }
                    | Event::AudioLoss { .. }
                    | Event::StartupSamplesDropped { .. }
                    | Event::Clipped
                    | Event::SilenceWhileSourceActive { .. }
            ) {
                self.quality_issues += 1;
            }
            ensure!(
                !matches!(
                    event,
                    Event::DeviceLost
                        | Event::StreamStalled
                        | Event::PermissionDenied { .. }
                        | Event::Error(_)
                        | Event::TerminalError { .. }
                        | Event::RecoverableError { .. }
                        | Event::ShutdownError { .. }
                ),
                "{} capture interrupted; inspect local events.jsonl",
                self.name
            );
        }
        // Valid digital silence still produces chunks. An empty stream is not success.
        ensure!(
            self.last_chunk.elapsed() < Duration::from_secs(10),
            "{} produced no audio buffers for 10 seconds",
            self.name
        );
        Ok(())
    }

    fn stats(&self) -> serde_json::Value {
        json!({"source": self.name, "frames": self.writer.frames(), "duration_ms": self.writer.frames() * 1000 / SAMPLE_RATE as u64,
            "missing_frames": self.writer.missing_frames(), "quality_issues": self.quality_issues,
            "chunks": self.chunks, "peak": self.peak, "requested_start_ms": self.requested_start_ms,
            "first_arrival_ns": self.first_arrival_ns, "last_arrival_ns": self.last_arrival_ns})
    }
}

fn start_lanes(
    lanes: &mut [Lane],
    began: Instant,
    deadline: Instant,
    stopped: &AtomicBool,
) -> Result<()> {
    for lane in lanes {
        ensure!(
            !stopped.load(Ordering::Relaxed),
            "recording cancelled during startup"
        );
        ensure!(
            Instant::now() < deadline,
            "recording deadline reached during startup"
        );
        lane.requested_start_ms = began.elapsed().as_millis() as u64;
        lane.stream.start()?;
        lane.last_chunk = Instant::now();
        ensure!(
            !stopped.load(Ordering::Relaxed),
            "recording cancelled during startup"
        );
        ensure!(
            Instant::now() < deadline,
            "recording deadline reached during startup"
        );
    }
    Ok(())
}

pub fn record(
    output: &Path,
    duration: Duration,
    mic: Option<String>,
    system: Option<String>,
    stopped: &AtomicBool,
) -> Result<()> {
    create_private_directory(output)?;
    write_json(
        &output.join("session.json"),
        &json!({
            "schema_version": 1, "state": "starting", "worker_pid": std::process::id(), "started_unix_ms": SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis(),
            "maximum_seconds": duration.as_secs(), "sample_rate": SAMPLE_RATE, "channels_per_track": 1,
            "mic_device": mic, "system_device": system, "audio_storage": "local_only",
            "echo_cancellation": false, "cross_source_alignment_verified": false,
            "timeline_basis": "independent_source_sample_clocks", "arrival_timestamps_are_media_clock": false,
        }),
    )?;
    let mut events = create_private_file(&output.join("events.jsonl"))?;
    eprintln!("Starting local mic + system capture; system output includes other apps. Ctrl+C stops both.");
    let began = Instant::now();
    let deadline = began + duration;
    let mut lanes: Vec<Lane> = Vec::new();
    // Keep output alive until both capture streams have stopped. This writes digital
    // silence, not captured audio, and does not change the volume or mute the device.
    let mut keepalive = None;
    let result = (|| -> Result<()> {
        keepalive = Some(crate::keepalive::Keepalive::start(system.as_deref())?);
        // Prepare both sources before either records. Retain ownership on every failure path.
        for (name, kind, device) in [
            ("mic", SourceKind::Mic, mic),
            ("system", SourceKind::SystemLoopback, system),
        ] {
            ensure!(
                !stopped.load(Ordering::Relaxed),
                "recording cancelled during startup"
            );
            lanes.push(Lane::open(name, kind, device, output)?);
            ensure!(
                !stopped.load(Ordering::Relaxed),
                "recording cancelled during startup"
            );
            ensure!(
                Instant::now() < deadline,
                "recording deadline reached during startup"
            );
        }
        start_lanes(&mut lanes, began, deadline, stopped)?;
        let mut next_checkpoint = Instant::now();
        while Instant::now() < deadline && !stopped.load(Ordering::Relaxed) {
            if let Some(output) = &keepalive {
                output.check()?;
            }
            for lane in &mut lanes {
                lane.drain(&mut events, false)?;
            }
            if Instant::now() >= next_checkpoint {
                for lane in &mut lanes {
                    lane.writer.checkpoint()?;
                    eprintln!(
                        "{}: {:.1}s peak={:.3} missing_frames={}",
                        lane.name,
                        lane.writer.frames() as f64 / SAMPLE_RATE as f64,
                        lane.peak,
                        lane.writer.missing_frames()
                    );
                }
                events.flush()?;
                next_checkpoint = Instant::now() + Duration::from_secs(1);
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        Ok(())
    })();
    // Always stop BOTH sources before finalizing files, even after startup/capture failure.
    let mut failure = result.err();
    for lane in &mut lanes {
        if let Err(error) = lane.stream.stop_checked() {
            failure.get_or_insert_with(|| error.into());
        }
    }
    #[cfg(target_os = "macos")]
    drop(keepalive);
    for lane in &mut lanes {
        if let Err(error) = lane.drain(&mut events, true) {
            failure.get_or_insert(error);
        }
        if lane.chunks == 0 {
            failure.get_or_insert_with(|| anyhow::anyhow!("{} captured no buffers", lane.name));
        }
    }
    let stats: Vec<_> = lanes.iter().map(Lane::stats).collect();
    let degraded = lanes
        .iter()
        .any(|l| l.quality_issues > 0 || l.writer.missing_frames() > 0);
    for lane in lanes {
        if let Err(error) = lane.writer.finish() {
            failure.get_or_insert(error);
        }
    }
    events.sync_all()?;
    write_json(
        &output.join("result.json"),
        &json!({
            "state": if failure.is_some() {"failed"} else if degraded {"partial"} else {"captured"},
            "stop_requested": stopped.load(Ordering::Relaxed), "elapsed_ms": began.elapsed().as_millis(),
            "error": failure.as_ref().map(ToString::to_string), "tracks": stats,
            "echo_cancellation": false, "cross_source_alignment_verified": false,
        }),
    )?;
    if let Some(error) = failure {
        return Err(error);
    }
    eprintln!(
        "Saved local tracks to {}. Audio is retained until you delete this prototype session.",
        output.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_final_padding_is_logged_without_marking_capture_partial() {
        let temp = tempfile::tempdir().unwrap();
        let mut events = create_private_file(&temp.path().join("events.jsonl")).unwrap();
        let mut lane = Lane {
            name: "mic",
            stream: Stream::open(
                StreamConfig::default(),
                Box::new(flexaudio::MockBackend::new(48_000, 1, 0.0)),
            )
            .unwrap(),
            writer: TrackWriter::create(&temp.path().join("mic.wav")).unwrap(),
            chunks: 0,
            peak: 0.0,
            requested_start_ms: 0,
            first_arrival_ns: None,
            last_arrival_ns: None,
            last_chunk: Instant::now(),
            quality_issues: 0,
        };
        let chunk = |index| AudioChunk {
            data: vec![0.0; 320],
            frames: 320,
            frame_index: index,
            pts_ns: 0,
            seq: 0,
            flags: flexaudio::ChunkFlags::PADDED,
            dropped_before: 0,
            peak: 0.0,
            rms: 0.0,
        };
        lane.accept(chunk(0), &mut events, true).unwrap();
        assert_eq!(lane.quality_issues, 0);
        lane.accept(chunk(960), &mut events, false).unwrap();
        assert_eq!(
            lane.quality_issues, 1,
            "padding during capture still requires inspection"
        );
        assert!(std::fs::read_to_string(temp.path().join("events.jsonl"))
            .unwrap()
            .contains("PADDED"));
    }

    #[test]
    fn cancellation_after_first_start_prevents_second_start() {
        use flexaudio::core::backend::{CaptureBackend, RawSink};
        use std::sync::{atomic::AtomicUsize, Arc};
        struct Backend {
            stopped: Arc<AtomicBool>,
            calls: Arc<AtomicUsize>,
        }
        impl CaptureBackend for Backend {
            fn native_format(&self) -> (u32, u16) {
                (48_000, 1)
            }
            fn start(&mut self, _: RawSink) -> flexaudio::Result<()> {
                self.calls.fetch_add(1, Ordering::Relaxed);
                self.stopped.store(true, Ordering::Relaxed);
                Ok(())
            }
            fn stop(&mut self) {}
        }
        let temp = tempfile::tempdir().unwrap();
        let stopped = Arc::new(AtomicBool::new(false));
        let calls = Arc::new(AtomicUsize::new(0));
        let mut lanes = Vec::new();
        for name in ["mic", "system"] {
            lanes.push(Lane {
                name,
                stream: Stream::open(
                    StreamConfig::default(),
                    Box::new(Backend {
                        stopped: stopped.clone(),
                        calls: calls.clone(),
                    }),
                )
                .unwrap(),
                writer: TrackWriter::create(&temp.path().join(format!("{name}.wav"))).unwrap(),
                chunks: 0,
                peak: 0.0,
                requested_start_ms: 0,
                first_arrival_ns: None,
                last_arrival_ns: None,
                last_chunk: Instant::now(),
                quality_issues: 0,
            });
        }
        let began = Instant::now();
        let result = start_lanes(&mut lanes, began, began + Duration::from_secs(5), &stopped);
        assert!(result.unwrap_err().to_string().contains("cancelled"));
        assert_eq!(calls.load(Ordering::Relaxed), 1);
        for lane in &mut lanes {
            lane.stream.stop_checked().unwrap();
        }
    }

    #[test]
    fn synthetic_two_source_capture_normalizes_without_opening_devices() {
        let temp = tempfile::tempdir().unwrap();
        let mut events = create_private_file(&temp.path().join("events.jsonl")).unwrap();
        let mut lanes = Vec::new();
        for (name, rate, channels, frequency) in
            [("mic", 44_100, 1, 440.0), ("system", 48_000, 2, 880.0)]
        {
            let stream = Stream::open(
                StreamConfig {
                    output: OutputFormat {
                        sample_rate: SAMPLE_RATE,
                        channels: 1,
                    },
                    silence_probe: false,
                    ..Default::default()
                },
                Box::new(flexaudio::MockBackend::new(rate, channels, frequency)),
            )
            .unwrap();
            lanes.push(Lane {
                name,
                stream,
                writer: TrackWriter::create(&temp.path().join(format!("{name}.wav"))).unwrap(),
                chunks: 0,
                peak: 0.0,
                requested_start_ms: 0,
                first_arrival_ns: None,
                last_arrival_ns: None,
                last_chunk: Instant::now(),
                quality_issues: 0,
            });
        }
        for lane in &mut lanes {
            lane.stream.start().unwrap();
        }
        let deadline = Instant::now() + Duration::from_millis(300);
        while Instant::now() < deadline {
            for lane in &mut lanes {
                lane.drain(&mut events, false).unwrap();
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        for lane in &mut lanes {
            lane.stream.stop_checked().unwrap();
        }
        for mut lane in lanes {
            lane.drain(&mut events, true).unwrap();
            assert!(lane.chunks > 3);
            assert!(lane.peak > 0.1);
            assert_eq!(lane.writer.missing_frames(), 0);
            lane.writer.finish().unwrap();
            let wav =
                hound::WavReader::open(temp.path().join(format!("{}.wav", lane.name))).unwrap();
            assert_eq!(wav.spec().sample_rate, SAMPLE_RATE);
            assert!(wav.duration() > 1000);
        }
    }
}
