use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};

type PasswordResult = Result<Option<String>, String>;
#[derive(Default)]
struct PasswordCache(HashMap<(String, String), PasswordResult>);
impl PasswordCache {
    fn read(
        &mut self,
        service: &str,
        account: &str,
        load: impl FnOnce() -> PasswordResult,
    ) -> PasswordResult {
        self.0
            .entry((service.into(), account.into()))
            .or_insert_with(load)
            .clone()
    }
}
fn cache() -> &'static Mutex<PasswordCache> {
    static CACHE: OnceLock<Mutex<PasswordCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(PasswordCache::default()))
}
// Serialize first access as well as caching it: simultaneous status checks must
// not open several macOS authorization dialogs. Cache failures until an explicit
// credential update; background polling must never retry a denied prompt.
pub fn read(service: &str, account: &str) -> PasswordResult {
    cache()
        .lock()
        .map_err(|_| "Credential cache unavailable".to_owned())?
        .read(service, account, || {
            match keyring::Entry::new(service, account).and_then(|entry| entry.get_password()) {
                Ok(password) => Ok(Some(password)),
                Err(keyring::Error::NoEntry) => Ok(None),
                Err(error) => Err(error.to_string()),
            }
        })
}
// Status surfaces only inspect memory; checking readiness must not unlock secrets.
pub fn available(service: &str, account: &str) -> Option<bool> {
    cache()
        .lock()
        .ok()?
        .0
        .get(&(service.into(), account.into()))
        .map(|result| {
            result
                .as_ref()
                .ok()
                .and_then(|value| value.as_ref())
                .is_some_and(|value| !value.is_empty())
        })
}
pub fn remember(service: &str, account: &str, password: Option<String>) {
    if let Ok(mut cache) = cache().lock() {
        cache
            .0
            .insert((service.into(), account.into()), Ok(password));
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_reads_and_denials_do_not_repeat_keychain_access() {
        let mut cache = PasswordCache::default();
        for _ in 0..3 {
            assert_eq!(
                cache
                    .read("test", "user", || Ok(Some("fixture".into())))
                    .unwrap(),
                Some("fixture".into())
            );
        }
        let mut calls = 0;
        for _ in 0..3 {
            assert!(cache
                .read("test", "denied", || {
                    calls += 1;
                    Err("denied".into())
                })
                .is_err());
        }
        assert_eq!(calls, 1);
        assert_eq!(
            cache
                .read("test", "user", || panic!("cached read must not prompt"))
                .unwrap(),
            Some("fixture".into())
        );
    }
}
