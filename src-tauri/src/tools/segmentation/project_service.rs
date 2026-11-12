use std::fs;
use std::path::{Path, PathBuf};

use super::data_models::{
    ProjectDisplayData, SegmentationProject, ThresholdResultItem,
};

pub struct SegmentationProjectService {
    data_path: PathBuf,
}

impl SegmentationProjectService {
    pub fn new(data_path: PathBuf) -> Self {
        if !data_path.exists() {
            let _ = fs::create_dir_all(&data_path);
        }
        Self { data_path }
    }

    /// List all projects in the data directory.
    pub fn get_all_projects(&self) -> Vec<SegmentationProject> {
        let mut projects = Vec::new();
        if let Ok(entries) = fs::read_dir(&self.data_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let project_file = path.join("project.json");
                    if let Ok(content) = fs::read_to_string(&project_file) {
                        if let Ok(project) = serde_json::from_str::<SegmentationProject>(&content) {
                            projects.push(project);
                        }
                    }
                }
            }
        }
        projects.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
        projects
    }

    /// Create a new project from a source image path.
    pub fn create_new_project(
        &self,
        source_image_path: &str,
    ) -> Result<SegmentationProject, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let project_dir = self.data_path.join(&id);
        fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;

        // Copy source image into project directory
        let source = Path::new(source_image_path);
        let ext = source
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png");
        let dest = project_dir.join(format!("source.{}", ext));
        fs::copy(source, &dest).map_err(|e| format!("Failed to copy image: {}", e))?;

        let now = chrono::Utc::now().to_rfc3339();
        let project = SegmentationProject {
            id: id.clone(),
            name: source
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled")
                .to_string(),
            source_image_path: dest.to_string_lossy().to_string(),
            smart_model_name: None,
            smart_segmentation_result: None,
            threshold_results: None,
            manual_polygons: None,
            display_data: ProjectDisplayData {
                mode: "New".to_string(),
                object_count: 0,
                summary: "Project created".to_string(),
                processing_duration_ms: 0,
            },
            created_at: now.clone(),
            modified_at: now,
        };

        self.save_project(&project)?;
        Ok(project)
    }

    /// Save a project to disk.
    pub fn save_project(&self, project: &SegmentationProject) -> Result<(), String> {
        let project_dir = self.data_path.join(&project.id);
        if !project_dir.exists() {
            fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
        }

        let json = serde_json::to_string_pretty(project).map_err(|e| e.to_string())?;
        let project_file = project_dir.join("project.json");
        fs::write(project_file, json).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Load a project by ID.
    pub fn load_project(&self, project_id: &str) -> Result<SegmentationProject, String> {
        let project_file = self.data_path.join(project_id).join("project.json");
        let content = fs::read_to_string(&project_file).map_err(|e| e.to_string())?;
        let project =
            serde_json::from_str::<SegmentationProject>(&content).map_err(|e| e.to_string())?;
        Ok(project)
    }

    /// Get the absolute path to the source image of a project.
    pub fn get_source_image_path(&self, project: &SegmentationProject) -> PathBuf {
        PathBuf::from(&project.source_image_path)
    }

    /// Update display data based on current project results.
    pub fn update_display_data(project: &mut SegmentationProject) {
        let mut object_count = 0;
        let mut mode = String::new();
        let mut summary = String::new();

        if let Some(ref smart) = project.smart_segmentation_result {
            mode = "Smart".to_string();
            object_count = smart.detections.len();
            summary = format!(
                "Model: {}, {} objects detected",
                smart.model_name, object_count
            );
        } else if let Some(ref threshold) = project.threshold_results {
            mode = "Threshold".to_string();
            object_count = threshold.results.len();
            let avg_area: f64 = if object_count > 0 {
                threshold.results.iter().map(|r| r.area).sum::<f64>() / object_count as f64
            } else {
                0.0
            };
            summary = format!(
                "{} objects, avg area: {:.1} px²",
                object_count, avg_area
            );
        } else if let Some(ref manual) = project.manual_polygons {
            mode = "Manual".to_string();
            object_count = manual.len();
            summary = format!("{} manual polygons", object_count);
        } else {
            mode = "New".to_string();
            summary = "No analysis performed".to_string();
        }

        project.display_data = ProjectDisplayData {
            mode,
            object_count,
            summary,
            processing_duration_ms: 0,
        };
    }

    /// Export threshold results to CSV.
    pub fn export_threshold_csv(
        results: &[ThresholdResultItem],
        path: &str,
        image_name: &str,
        unit: &str,
    ) -> Result<(), String> {
        let mut wtr = csv::Writer::from_path(path).map_err(|e| e.to_string())?;
        wtr.write_record(["ImageName", "ObjectID", "Area", "CalculatedArea", "Unit", "Perimeter", "Circularity", "CentroidX", "CentroidY"])
            .map_err(|e| e.to_string())?;

        for r in results {
            wtr.write_record([
                image_name,
                &r.display_index.to_string(),
                &r.area.to_string(),
                &r.calculated_area_with_unit,
                unit,
                &r.perimeter.to_string(),
                &format!("{:.4}", r.circularity),
                &format!("{:.1}", r.centroid_x),
                &format!("{:.1}", r.centroid_y),
            ])
            .map_err(|e| e.to_string())?;
        }

        wtr.flush().map_err(|e| e.to_string())?;
        Ok(())
    }
}
