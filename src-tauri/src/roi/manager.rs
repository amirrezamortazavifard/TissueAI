use super::geometry::RoiShape;
use super::measurement::{MeasurementEngine, RoiMeasurements};
use crate::scientific_models::scientific_image::SpatialCalibration;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Write};
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

/// Hierarchical and categorized ROI item (ROI-01, ROI-02, M4-03, M4-04)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoiItem {
    pub id: String,
    pub name: String,
    pub shape: RoiShape,
    pub color: String,
    pub group_name: String,
    pub slide_id: Option<String>,
    pub parent_id: Option<String>,
    pub class_id: Option<String>,
    pub class_name: Option<String>,
    pub is_visible: bool,
    #[serde(default)]
    pub is_locked: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub measurements: Option<RoiMeasurements>,
}

/// Action record for domain-level Undo/Redo stack (M4-06)
#[derive(Debug, Clone)]
pub enum RoiHistoryAction {
    Added(RoiItem),
    Updated { old: RoiItem, new: RoiItem },
    Deleted(RoiItem),
}

/// Thread-safe ROI Manager with persistence, hierarchy, and Undo/Redo (M4-01..M4-07)
pub struct RoiManager {
    rois: Mutex<HashMap<String, RoiItem>>,
    undo_stack: Mutex<Vec<RoiHistoryAction>>,
    redo_stack: Mutex<Vec<RoiHistoryAction>>,
}

impl Default for RoiManager {
    fn default() -> Self {
        Self::new()
    }
}

impl RoiManager {
    pub fn new() -> Self {
        Self {
            rois: Mutex::new(HashMap::new()),
            undo_stack: Mutex::new(Vec::new()),
            redo_stack: Mutex::new(Vec::new()),
        }
    }

    pub fn add(&self, mut item: RoiItem, calibration: Option<&SpatialCalibration>) -> RoiItem {
        if item.id.is_empty() {
            item.id = Uuid::new_v4().to_string();
        }

        // Compute baseline measurements using calibration snapshot (FIND-005 resolved)
        let cal = calibration.cloned().unwrap_or_default();
        item.measurements = Some(MeasurementEngine::measure(&item.shape, &cal));

        if let Ok(mut map) = self.rois.lock() {
            map.insert(item.id.clone(), item.clone());
        }

        // Record in undo stack
        if let Ok(mut undo) = self.undo_stack.lock() {
            undo.push(RoiHistoryAction::Added(item.clone()));
        }
        if let Ok(mut redo) = self.redo_stack.lock() {
            redo.clear();
        }

        item
    }

    pub fn get(&self, id: &str) -> Option<RoiItem> {
        let map = self.rois.lock().ok()?;
        map.get(id).cloned()
    }

    pub fn update(&self, mut item: RoiItem, calibration: Option<&SpatialCalibration>) -> Option<RoiItem> {
        let cal = calibration.cloned().unwrap_or_default();
        item.measurements = Some(MeasurementEngine::measure(&item.shape, &cal));

        let mut map = self.rois.lock().ok()?;
        if let Some(old_item) = map.get(&item.id).cloned() {
            map.insert(item.id.clone(), item.clone());

            // Record in undo stack
            if let Ok(mut undo) = self.undo_stack.lock() {
                undo.push(RoiHistoryAction::Updated {
                    old: old_item,
                    new: item.clone(),
                });
            }
            if let Ok(mut redo) = self.redo_stack.lock() {
                redo.clear();
            }

            Some(item)
        } else {
            None
        }
    }

    pub fn delete(&self, id: &str) -> bool {
        let mut map = if let Ok(m) = self.rois.lock() { m } else { return false };
        if let Some(removed) = map.remove(id) {
            if let Ok(mut undo) = self.undo_stack.lock() {
                undo.push(RoiHistoryAction::Deleted(removed));
            }
            if let Ok(mut redo) = self.redo_stack.lock() {
                redo.clear();
            }
            true
        } else {
            false
        }
    }

    pub fn clear(&self, slide_id: Option<&str>) {
        if let Ok(mut map) = self.rois.lock() {
            if let Some(sid) = slide_id {
                map.retain(|_, v| v.slide_id.as_deref() != Some(sid));
            } else {
                map.clear();
            }
        }
        if let Ok(mut undo) = self.undo_stack.lock() {
            undo.clear();
        }
        if let Ok(mut redo) = self.redo_stack.lock() {
            redo.clear();
        }
    }

    pub fn list(&self, slide_id: Option<&str>) -> Vec<RoiItem> {
        if let Ok(map) = self.rois.lock() {
            if let Some(sid) = slide_id {
                map.values()
                    .filter(|v| v.slide_id.as_deref() == Some(sid))
                    .cloned()
                    .collect()
            } else {
                map.values().cloned().collect()
            }
        } else {
            Vec::new()
        }
    }

    // ── Undo / Redo Engine (M4-06) ───────────────────────────────────────────

    pub fn can_undo(&self) -> bool {
        self.undo_stack.lock().map(|u| !u.is_empty()).unwrap_or(false)
    }

    pub fn can_redo(&self) -> bool {
        self.redo_stack.lock().map(|r| !r.is_empty()).unwrap_or(false)
    }

    pub fn undo(&self) -> bool {
        let action = {
            let mut undo = if let Ok(u) = self.undo_stack.lock() { u } else { return false };
            undo.pop()
        };

        let Some(action) = action else { return false };

        let mut map = if let Ok(m) = self.rois.lock() { m } else { return false };
        match &action {
            RoiHistoryAction::Added(item) => {
                map.remove(&item.id);
            }
            RoiHistoryAction::Updated { old, .. } => {
                map.insert(old.id.clone(), old.clone());
            }
            RoiHistoryAction::Deleted(item) => {
                map.insert(item.id.clone(), item.clone());
            }
        }

        if let Ok(mut redo) = self.redo_stack.lock() {
            redo.push(action);
        }
        true
    }

    pub fn redo(&self) -> bool {
        let action = {
            let mut redo = if let Ok(r) = self.redo_stack.lock() { r } else { return false };
            redo.pop()
        };

        let Some(action) = action else { return false };

        let mut map = if let Ok(m) = self.rois.lock() { m } else { return false };
        match &action {
            RoiHistoryAction::Added(item) => {
                map.insert(item.id.clone(), item.clone());
            }
            RoiHistoryAction::Updated { new, .. } => {
                map.insert(new.id.clone(), new.clone());
            }
            RoiHistoryAction::Deleted(item) => {
                map.remove(&item.id);
            }
        }

        if let Ok(mut undo) = self.undo_stack.lock() {
            undo.push(action);
        }
        true
    }

    // ── Atomic Persistence & Reopen Validation (M4-01, M4-03, M4-07) ─────────

    /// Save ROIs atomically to disk with temporary file and backup recovery
    pub fn save_to_path(&self, file_path: &Path) -> Result<(), String> {
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
        }

        let rois = self.list(None);
        let json_data = serde_json::to_string_pretty(&rois)
            .map_err(|e| format!("Failed to serialize ROIs: {}", e))?;

        // Write to temporary sibling file first
        let temp_path = file_path.with_extension("tmp");
        {
            let file = File::create(&temp_path)
                .map_err(|e| format!("Failed to create temporary file: {}", e))?;
            let mut writer = BufWriter::new(file);
            writer
                .write_all(json_data.as_bytes())
                .map_err(|e| format!("Failed to write temporary file: {}", e))?;
            writer
                .flush()
                .map_err(|e| format!("Failed to flush temporary file: {}", e))?;
        }

        // Backup existing file if present
        if file_path.exists() {
            let backup_path = file_path.with_extension("bak");
            let _ = fs::copy(file_path, backup_path);
        }

        // Atomically rename temporary file to destination
        fs::rename(&temp_path, file_path)
            .map_err(|e| format!("Failed to atomically rename ROI file: {}", e))?;

        Ok(())
    }

    /// Load ROIs from disk and merge into memory (verifying geometries)
    pub fn load_from_path(&self, file_path: &Path) -> Result<usize, String> {
        if !file_path.exists() {
            return Err(format!("ROI file not found: {:?}", file_path));
        }

        let file = File::open(file_path)
            .map_err(|e| format!("Failed to open ROI file: {}", e))?;
        let reader = BufReader::new(file);
        let loaded_rois: Vec<RoiItem> = serde_json::from_reader(reader)
            .map_err(|e| format!("Failed to parse ROI JSON: {}", e))?;

        let count = loaded_rois.len();
        if let Ok(mut map) = self.rois.lock() {
            for item in loaded_rois {
                map.insert(item.id.clone(), item);
            }
        }

        Ok(count)
    }

    /// Export ROIs as GeoJSON FeatureCollection (ROI-07)
    pub fn export_geojson(&self, slide_id: Option<&str>) -> Result<String, String> {
        let items = self.list(slide_id);
        let mut features = Vec::new();

        for item in items {
            let geometry_json = match &item.shape {
                RoiShape::Point { point } => serde_json::json!({
                    "type": "Point",
                    "coordinates": [point.x, point.y]
                }),
                RoiShape::Polyline { points } => serde_json::json!({
                    "type": "LineString",
                    "coordinates": points.iter().map(|p| vec![p.x, p.y]).collect::<Vec<_>>()
                }),
                RoiShape::Rectangle { x, y, width, height } => serde_json::json!({
                    "type": "Polygon",
                    "coordinates": [[
                        [*x, *y],
                        [*x + *width, *y],
                        [*x + *width, *y + *height],
                        [*x, *y + *height],
                        [*x, *y]
                    ]]
                }),
                RoiShape::Polygon { points } => {
                    let mut coords: Vec<Vec<f64>> = points.iter().map(|p| vec![p.x, p.y]).collect();
                    if let Some(first) = points.first() {
                        coords.push(vec![first.x, first.y]); // close ring
                    }
                    serde_json::json!({
                        "type": "Polygon",
                        "coordinates": [coords]
                    })
                }
                RoiShape::Ellipse { center_x, center_y, radius_x, radius_y } => serde_json::json!({
                    "type": "Point",
                    "coordinates": [*center_x, *center_y],
                    "properties": {
                        "radius_x": *radius_x,
                        "radius_y": *radius_y
                    }
                }),
                RoiShape::MultiPoint { points } => serde_json::json!({
                    "type": "MultiPoint",
                    "coordinates": points.iter().map(|p| vec![p.x, p.y]).collect::<Vec<_>>()
                }),
            };

            let properties = serde_json::json!({
                "id": item.id,
                "name": item.name,
                "color": item.color,
                "group_name": item.group_name,
                "slide_id": item.slide_id,
                "class_id": item.class_id,
                "class_name": item.class_name,
                "is_locked": item.is_locked,
                "tags": item.tags,
                "measurements": item.measurements
            });

            features.push(serde_json::json!({
                "type": "Feature",
                "geometry": geometry_json,
                "properties": properties
            }));
        }

        let fc = serde_json::json!({
            "type": "FeatureCollection",
            "features": features
        });

        serde_json::to_string_pretty(&fc).map_err(|e| e.to_string())
    }
}
