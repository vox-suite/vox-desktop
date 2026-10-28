//! Keep the chosen macOS output clock running during digital silence.
//! No samples from the recording are rendered; this stream writes zeros only.
#[cfg(target_os = "macos")]
mod macos {
    use anyhow::{bail, ensure, Context, Result};
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };

    pub struct Keepalive {
        _stream: cpal::Stream,
        failed: Arc<AtomicBool>,
    }

    impl Keepalive {
        pub fn start(selected: Option<&str>) -> Result<Self> {
            let host = cpal::default_host();
            let device = if let Some(id) = selected {
                let name = flexaudio::devices()?
                    .into_iter()
                    .find(|device| device.is_loopback && device.id == id)
                    .context("selected system output not found for silence keepalive")?
                    .name;
                let mut matches = host
                    .output_devices()?
                    .filter(|d| d.name().ok().as_deref() == Some(&name));
                let device = matches
                    .next()
                    .context("selected output is unavailable to silence keepalive")?;
                ensure!(
                    matches.next().is_none(),
                    "ambiguous output device name; cannot safely select keepalive output"
                );
                device
            } else {
                host.default_output_device()
                    .context("no default output device")?
            };
            let format = device.default_output_config()?;
            let config = format.config();
            let failed = Arc::new(AtomicBool::new(false));
            let error = failed.clone();
            let on_error = move |_| {
                error.store(true, Ordering::Relaxed);
            };
            let stream = match format.sample_format() {
                cpal::SampleFormat::F32 => device.build_output_stream(
                    &config,
                    |samples: &mut [f32], _| samples.fill(0.0),
                    on_error,
                    None,
                )?,
                cpal::SampleFormat::I16 => device.build_output_stream(
                    &config,
                    |samples: &mut [i16], _| samples.fill(0),
                    on_error,
                    None,
                )?,
                cpal::SampleFormat::U16 => device.build_output_stream(
                    &config,
                    |samples: &mut [u16], _| samples.fill(32768),
                    on_error,
                    None,
                )?,
                _ => bail!("unsupported silence keepalive format"),
            };
            stream.play()?;
            Ok(Self {
                _stream: stream,
                failed,
            })
        }

        pub fn check(&self) -> Result<()> {
            ensure!(
                !self.failed.load(Ordering::Relaxed),
                "system output silence keepalive failed"
            );
            Ok(())
        }
    }
}

#[cfg(target_os = "macos")]
pub use macos::Keepalive;

#[cfg(not(target_os = "macos"))]
pub struct Keepalive;
#[cfg(not(target_os = "macos"))]
impl Keepalive {
    pub fn start(_: Option<&str>) -> anyhow::Result<Self> {
        Ok(Self)
    }
    pub fn check(&self) -> anyhow::Result<()> {
        Ok(())
    }
}
