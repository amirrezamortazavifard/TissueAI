use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SavedSceneObject {
    pub name: String,
    pub model_type: String,
    pub model_path: Option<String>,
    pub position: [f64; 3],
    pub rotation: [f64; 3],
    pub scale: [f64; 3],
    pub color: String,
    pub visible: bool,
    pub wireframe: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SavedScene {
    pub version: u32,
    pub objects: Vec<SavedSceneObject>,
}

#[tauri::command]
pub async fn save_scene(path: String, scene_json: String) -> Result<(), String> {
    fs::write(&path, &scene_json).map_err(|e| format!("Failed to save scene: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_scene(path: String) -> Result<String, String> {
    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to load scene: {}", e))?;
    Ok(content)
}
