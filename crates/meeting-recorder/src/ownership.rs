use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
#[derive(Default, Clone)]
pub struct AudioOwnership(Arc<AtomicBool>);
pub struct AudioLease(Arc<AtomicBool>);
impl AudioOwnership {
    pub fn acquire(&self) -> Result<AudioLease, String> {
        self.0
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| {
                "Stop the current recording or Talk to Vox before starting another audio session"
                    .to_owned()
            })?;
        Ok(AudioLease(self.0.clone()))
    }
}
impl Drop for AudioLease {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn capture_and_voice_cannot_own_the_microphone_together() {
        let gate = AudioOwnership::default();
        let voice = gate.acquire().unwrap();
        assert!(gate.acquire().is_err());
        drop(voice);
        assert!(gate.acquire().is_ok());
    }
}
