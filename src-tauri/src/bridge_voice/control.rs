use tokio::sync::oneshot;

pub(super) fn text_frame(text: &str) -> Result<String, String> {
    if text.trim().is_empty() || text.len() > 8192 {
        return Err("Enter a shorter message".into());
    }
    let frame = serde_json::json!({"type":"text","text":text}).to_string();
    if frame.len() > 8192 {
        return Err("Enter a shorter message".into());
    }
    Ok(frame)
}

pub(super) async fn until_stopped<T>(
    stop: &mut oneshot::Receiver<()>,
    operation: impl std::future::Future<Output = Result<T, String>>,
) -> Result<T, String> {
    tokio::select! {
        biased;
        _ = stop => Err("Voice session cancelled".into()),
        result = operation => result,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_text_that_exceeds_wire_limit_after_framing_or_escaping() {
        assert!(text_frame(&"a".repeat(8192)).is_err());
        assert!(text_frame(&"\"".repeat(4090)).is_err());
        let frame = text_frame("hello \"Vox\"").unwrap();
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&frame).unwrap()["text"],
            "hello \"Vox\""
        );
    }
    #[tokio::test]
    async fn stop_cancels_pending_setup_before_it_opens_audio() {
        let (tx, mut rx) = oneshot::channel();
        tx.send(()).unwrap();
        let opened = std::sync::atomic::AtomicBool::new(false);
        let result = until_stopped(&mut rx, async {
            opened.store(true, std::sync::atomic::Ordering::SeqCst);
            Ok(())
        })
        .await;
        assert!(result.is_err());
        assert!(!opened.load(std::sync::atomic::Ordering::SeqCst));
    }
    #[tokio::test]
    async fn stop_drops_setup_that_is_waiting_for_network() {
        let (tx, mut rx) = oneshot::channel();
        let (entered, started) = oneshot::channel();
        let (dropped, ended) = oneshot::channel();
        struct DropSignal(Option<oneshot::Sender<()>>);
        impl Drop for DropSignal {
            fn drop(&mut self) {
                if let Some(tx) = self.0.take() {
                    let _ = tx.send(());
                }
            }
        }
        let task = tokio::spawn(async move {
            until_stopped(&mut rx, async move {
                let _guard = DropSignal(Some(dropped));
                let _ = entered.send(());
                std::future::pending::<Result<(), String>>().await
            })
            .await
        });
        started.await.unwrap();
        tx.send(()).unwrap();
        assert!(task.await.unwrap().is_err());
        ended
            .await
            .expect("pending connection future must be dropped");
    }
}
