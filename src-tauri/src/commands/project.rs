use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use crate::project::{TissueAiProject, ImageAssetRef};

pub struct ProjectState {
    pub current_project: Mutex<Option<TissueAiProject>>,
    pub project_dir: Mutex<Option<PathBuf>>,
}

impl Default for ProjectState {
    fn default() -> Self {
        Self {
            current_project: Mutex::new(None),
            project_dir: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub async fn project_create(
    name: String,
    dir_path: String,
    description: Option<String>,
    state: State<'_, ProjectState>,
) -> Result<TissueAiProject, String> {
    let mut project = TissueAiProject::new(&name, description);
    let path = PathBuf::from(&dir_path);
    project.save_to_directory(&path)?;
    
    *state.current_project.lock().unwrap() = Some(project.clone());
    *state.project_dir.lock().unwrap() = Some(path);

    Ok(project)
}

#[tauri::command]
pub async fn project_open(
    dir_path: String,
    state: State<'_, ProjectState>,
) -> Result<TissueAiProject, String> {
    let path = PathBuf::from(&dir_path);
    let project = TissueAiProject::load_from_directory(&path)?;
    
    *state.current_project.lock().unwrap() = Some(project.clone());
    *state.project_dir.lock().unwrap() = Some(path);

    Ok(project)
}

#[tauri::command]
pub async fn project_save(
    state: State<'_, ProjectState>,
) -> Result<String, String> {
    let mut proj_guard = state.current_project.lock().unwrap();
    let dir_guard = state.project_dir.lock().unwrap();

    let project = proj_guard.as_mut().ok_or("No project currently open")?;
    let dir_path = dir_guard.as_ref().ok_or("No project directory configured")?;

    let file_path = project.save_to_directory(dir_path)?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn project_get_current(
    state: State<'_, ProjectState>,
) -> Result<Option<TissueAiProject>, String> {
    Ok(state.current_project.lock().unwrap().clone())
}

#[tauri::command]
pub async fn project_add_image(
    image: ImageAssetRef,
    dataset_id: Option<String>,
    state: State<'_, ProjectState>,
) -> Result<TissueAiProject, String> {
    let mut proj_guard = state.current_project.lock().unwrap();
    let project = proj_guard.as_mut().ok_or("No project currently open")?;
    project.add_image(image, dataset_id.as_deref());
    
    if let Some(dir_path) = state.project_dir.lock().unwrap().as_ref() {
        project.save_to_directory(dir_path)?;
    }

    Ok(project.clone())
}

