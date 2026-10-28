mod app_control;
mod audio;
mod auth;
mod bridge_voice;
mod codec;
mod config;
mod credential_cache;
mod deep_link;
mod device_cache;
mod device_link;
mod live_link;
mod local_voice;
mod meeting_analysis;
mod meetings;
mod meeting_recording;
mod meeting_models;
#[cfg(target_os = "macos")]
mod macos_location;
mod pkce;
mod projects;
mod session;
mod session_store;
mod sync_client;
mod system_stats;
mod terminal;
mod types;
mod wiz;

use auth::AuthManager;
use deep_link::{filter_vox_urls, handle_oauth_callback_urls};
use session::SessionManager;
use system_stats::SystemStatsState;
use tauri::{AppHandle, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

#[tauri::command]
async fn set_window_size(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_resizable(true);
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
        let _ = window.center();
    }
    Ok(())
}

#[tauri::command]
async fn center_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.center();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if projects::agent::serve_from_args() {
        return;
    }
    // Wrap in catch_unwind: dotenvy 0.15.7 panics on malformed .env files.
    let _ = std::panic::catch_unwind(|| {
        dotenvy::from_filename("../.env").ok();
        dotenvy::dotenv().ok();
    });

    let auth = match AuthManager::new() {
        Ok(auth) => auth,
        Err(err) => {
            eprintln!("Auth configuration error: {err}");
            panic!("{err}");
        }
    };

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let urls = filter_vox_urls(argv.iter().filter_map(|arg| url::Url::parse(arg).ok()));
            if !urls.is_empty() {
                handle_oauth_callback_urls(app, &urls);
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(auth)
        .manage(SessionManager::new())
        .manage(vox_meeting_recorder::ownership::AudioOwnership::default())
        .manage(meeting_recording::RecordingState::default())
        .manage(meeting_models::MeetingModelsState::default())
        .manage(device_link::DeviceLinkState::default())
        .manage(device_link::RemoteControl::load())
        .manage(device_link::EventLog::default())
        .manage(SystemStatsState::new())
        .manage(wiz::WizState::default())
        .manage(local_voice::download::ModelsState::default())
        .manage(app_control::AppControlState::default())
        .manage(bridge_voice::BridgeVoiceState::default())
        .manage(terminal::TerminalManager::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.state::<meeting_recording::RecordingState>().busy() { api.prevent_close(); return; }
                #[cfg(target_os = "macos")]
                { api.prevent_close(); let _ = window.hide(); }
            }
        })
        .setup(|app| {
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                if let Err(err) = app.deep_link().register_all() {
                    eprintln!("deep link registration warning: {err}");
                }
            }

            app.state::<terminal::TerminalManager>()
                .set_app_handle(app.handle().clone());
            app.state::<AuthManager>()
                .set_app_handle(app.handle().clone());

            let handle = app.handle().clone();
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                let vox_urls = filter_vox_urls(urls);
                if !vox_urls.is_empty() {
                    handle_oauth_callback_urls(&handle, &vox_urls);
                }
            }

            app.deep_link().on_open_url(move |event| {
                handle_oauth_callback_urls(&handle, &event.urls());
            });

            tauri::async_runtime::spawn(device_link::run_supervisor(app.handle().clone()));
            tauri::async_runtime::spawn(live_link::run_supervisor(app.handle().clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            meetings::meeting_import_transcript,
            meetings::meeting_export_text,
            meeting_recording::meeting_recording_start,
            meeting_recording::meeting_recording_status,
            meeting_recording::meeting_recording_stop,
            meeting_recording::meeting_model_ready,
            meeting_models::meeting_model_status,
            meeting_models::meeting_model_install,
            meeting_models::meeting_model_cancel,
            meeting_recording::meeting_model_choose,
            meeting_recording::meeting_transcribe,
            meeting_analysis::meeting_analyze,
            meeting_analysis::meeting_promote_action,
            meeting_analysis::meeting_dismiss_action,
            meetings::meeting_list,
            meetings::meeting_get,
            meetings::meeting_create,
            meetings::meeting_save_transcript,
            meetings::meeting_save_notes,
            meetings::meeting_delete,
            meetings::meeting_cleanup_audio,
            meetings::meeting_recover_interrupted,
            projects::project_engine_status,
            projects::project_install_engine,
            projects::project_pick_sources,
            projects::project_local_sources,
            projects::project_index_source,
            projects::project_graph,
            projects::diagram::project_render_diagram,
            projects::diagram::project_export_diagram,
            projects::agent::project_agent_status,
            projects::agent::project_agent_configure,
            projects::agent::project_agent_start,
            projects::agent::project_agent_runs,
            projects::agent::project_agent_dismiss,
            projects::agent::project_agent_cancel,
            projects::project_read_source,
            projects::project_check_sources,
            projects::project_remove_source,
            device_cache::cache_read,
            device_cache::cache_write,
            device_cache::cache_clear,
            terminal::terminal_open,
            terminal::terminal_output,
            terminal::terminal_input,
            terminal::terminal_resize,
            auth::get_auth_state,
            auth::sign_in_with_google,
            auth::sign_out,
            auth::link_phone,
            auth::start_phone_verification,
            auth::confirm_phone_verification,
            center_window,
            session::start_call,
            bridge_voice::set_call_muted,
            bridge_voice::list_microphones,
            bridge_voice::select_microphone,
            bridge_voice::send_desktop_text,
            app_control::set_app_context,
            app_control::complete_app_command,
            session::end_call,
            session::call_status,
            set_window_size,
            sync_client::core_http,
            device_link::get_device_link_status,
            device_link::get_remote_control,
            device_link::set_remote_control,
            device_link::get_local_events,
            device_link::run_gui_action_locally,
            system_stats::get_system_stats,
            local_voice::download::local_models_status,
            local_voice::download::download_local_models,
            wiz::get_wiz_status,
            wiz::connect_wiz,
            wiz::refresh_wiz,
            wiz::control_wiz,
            wiz::disconnect_wiz,
            #[cfg(target_os = "macos")]
            macos_location::get_native_location
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = &event {
                app.state::<meeting_models::MeetingModelsState>().cancel();
                let state = app.state::<meeting_recording::RecordingState>();
                if state.must_wait_for_shutdown() {
                    api.prevent_exit();
                    if state.begin_shutdown() {
                    state.stop();
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        for _ in 0..100 {
                            if !handle.state::<meeting_recording::RecordingState>().busy() { break; }
                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                        }
                        handle.state::<meeting_recording::RecordingState>().allow_exit();
                        handle.exit(0);
                    });
                    }
                }
            }
            if matches!(&event, tauri::RunEvent::Exit) { app.state::<meeting_recording::RecordingState>().stop(); }
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &event {
                let vox_urls =
                    filter_vox_urls(urls.iter().filter_map(|u| url::Url::parse(u.as_ref()).ok()));
                if !vox_urls.is_empty() {
                    eprintln!("RunEvent::Opened vox urls: {vox_urls:?}");
                    handle_oauth_callback_urls(app, &vox_urls);
                }
            }

            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if !has_visible_windows {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    let vox_urls = filter_vox_urls(urls);
                    if !vox_urls.is_empty() {
                        eprintln!("Reopen get_current vox urls: {vox_urls:?}");
                        handle_oauth_callback_urls(app, &vox_urls);
                    }
                }
            }
        });
}
