fn main() {
    for key in [
        "VOX_SUPABASE_URL",
        "VOX_SUPABASE_ANON_KEY",
        "VOX_API_URL",
        "VOX_BRIDGE_URL",
        "VOX_OAUTH_REDIRECT_URI",
        "VOX_MODELS_BASE_URL",
    ] {
        if let Ok(value) = std::env::var(key) {
            if !value.trim().is_empty() {
                println!("cargo:rustc-env={key}={value}");
            }
        }
        println!("cargo:rerun-if-env-changed={key}");
    }
    let os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    if os == "macos" && arch == "aarch64" {
        let dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        println!("cargo:rustc-link-search=native={dir}/vendor/needle/macos-arm64");
        println!("cargo:rustc-link-lib=static=needle");
        println!("cargo:rustc-link-lib=c++");
    }
    tauri_build::build()
}
