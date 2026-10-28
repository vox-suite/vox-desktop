//! Developer smoke test for the exact installer used by the desktop.
#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    let root = std::path::PathBuf::from(
        std::env::args_os()
            .nth(1)
            .ok_or_else(|| anyhow::anyhow!("Pass a new local model directory"))?,
    );
    let mut previous = 0;
    let path = vox_meeting_models::install_base(
        &root,
        &std::sync::atomic::AtomicBool::new(false),
        |n, verifying| {
            if verifying || n > previous + 10_000_000 {
                eprintln!("{} bytes; verifying={verifying}", n);
                previous = n;
            }
        },
    )
    .await?;
    println!("Verified local model: {}", path.display());
    Ok(())
}
