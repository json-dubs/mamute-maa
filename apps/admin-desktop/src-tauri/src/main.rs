#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri::{Emitter, Manager};

#[derive(Clone, Serialize)]
struct SingleInstancePayload {
  args: Vec<String>,
  cwd: String
}

#[tauri::command]
fn startup_args() -> Vec<String> {
  std::env::args().collect()
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
      let payload = SingleInstancePayload { args: argv, cwd };
      let _ = app.emit("single-instance", payload);
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }))
    .invoke_handler(tauri::generate_handler![startup_args])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
