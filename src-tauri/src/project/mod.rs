use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::scientific_models::SpatialCalibration;
use crate::roi::manager::RoiItem;

pub const PROJECT_SCHEMA_VERSION: u32 = 1;
pub const PROJECT_FILE_NAME: &str = "tissueai_project.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAssetRef {
    pub id: String,
    pub filename: String,
    pub original_path: String,
    pub relative_storage_path: Option<String>,
    pub width: u32,
    pub height: u32,
    pub channels: u16,
    pub is_pyramidal: bool,
    pub calibration: SpatialCalibration,
    pub rois: Vec<RoiItem>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetRef {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub image_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisPipelineRun {
    pub id: String,
    pub pipeline_name: String,
    pub target_image_id: String,
    pub parameters: serde_json::Value,
    pub status: String,
    pub executed_at: String,
    pub results_summary: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TissueAiProject {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub modified_at: String,
    pub datasets: Vec<DatasetRef>,
    pub images: Vec<ImageAssetRef>,
    pub pipeline_runs: Vec<AnalysisPipelineRun>,
}

impl TissueAiProject {
    pub fn new(name: &str, description: Option<String>) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            schema_version: PROJECT_SCHEMA_VERSION,
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            description,
            created_at: now.clone(),
            modified_at: now,
            datasets: vec![DatasetRef {
                id: Uuid::new_v4().to_string(),
                name: "Default Dataset".to_string(),
                description: Some("Initial project dataset".to_string()),
                image_ids: Vec::new(),
            }],
            images: Vec::new(),
            pipeline_runs: Vec::new(),
        }
    }

    pub fn add_image(&mut self, image_ref: ImageAssetRef, dataset_id: Option<&str>) {
        let img_id = image_ref.id.clone();
        self.images.push(image_ref);
        
        let target_dataset = if let Some(ds_id) = dataset_id {
            self.datasets.iter_mut().find(|d| d.id == ds_id)
        } else {
            self.datasets.first_mut()
        };

        if let Some(ds) = target_dataset {
            if !ds.image_ids.contains(&img_id) {
                ds.image_ids.push(img_id);
            }
        }
        self.modified_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn save_to_directory(&mut self, dir_path: &Path) -> Result<PathBuf, String> {
        if !dir_path.exists() {
            fs::create_dir_all(dir_path).map_err(|e| format!("Failed to create project dir: {}", e))?;
        }
        self.modified_at = chrono::Utc::now().to_rfc3339();
        let target_file = dir_path.join(PROJECT_FILE_NAME);
        let temp_file = dir_path.join(format!("{}.tmp", PROJECT_FILE_NAME));

        let data = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Serialization error: {}", e))?;

        {
            let mut file = fs::File::create(&temp_file)
                .map_err(|e| format!("Failed to create temp project file: {}", e))?;
            file.write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write temp project file: {}", e))?;
            file.sync_all()
                .map_err(|e| format!("Failed to sync temp project file: {}", e))?;
        }

        // Atomic rename / replace
        if target_file.exists() {
            let backup_file = dir_path.join(format!("{}.bak", PROJECT_FILE_NAME));
            let _ = fs::copy(&target_file, &backup_file);
        }

        fs::rename(&temp_file, &target_file)
            .map_err(|e| format!("Atomic rename failed: {}", e))?;

        Ok(target_file)
    }

    pub fn load_from_directory(dir_path: &Path) -> Result<Self, String> {
        let target_file = dir_path.join(PROJECT_FILE_NAME);
        if !target_file.exists() {
            return Err(format!("Project file not found at: {}", target_file.display()));
        }
        let content = fs::read_to_string(&target_file)
            .map_err(|e| format!("Failed to read project file: {}", e))?;
        let project: TissueAiProject = serde_json::from_str(&content)
            .map_err(|e| format!("Corrupt project JSON: {}", e))?;

        if project.schema_version > PROJECT_SCHEMA_VERSION {
            return Err(format!(
                "Project schema version {} is newer than supported version {}",
                project.schema_version, PROJECT_SCHEMA_VERSION
            ));
        }

        Ok(project)
    }
}

