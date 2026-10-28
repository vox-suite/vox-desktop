#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Some(result) = vox_meeting_recorder::worker::dispatch() {
        if let Err(error) = result {
            eprintln!("Local recording failed: {error}");
            std::process::exit(1);
        }
        return;
    }
    vox_desktop_lib::run()
}
