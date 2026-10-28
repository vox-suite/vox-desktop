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
    println!("cargo:rerun-if-changed=Info.plist");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let plist =
            std::path::Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("Info.plist");
        println!(
            "cargo:rustc-link-arg-bin=vox-desktop=-Wl,-sectcreate,__TEXT,__info_plist,{}",
            plist.display()
        );
    }
    tauri_build::build()
}
