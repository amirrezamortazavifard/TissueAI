use super::geometry::RoiShape;
use super::measurement::{MeasurementEngine, RoiMeasurements};
use crate::scientific_models::scientific_image::SpatialCalibration;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoiItem {
    pub id: String,
    pub name: String,
    pub shape: RoiShape,
    pub color: String,
    pub group_name: String,
    pub slide_id: Option<String>,
    pub is_visible: bool,
    pub measurements: Option<RoiMeasurements>,
}

#[derive(Default)]
pub struct RoiManager {
    rois: Mutex<HashMap<String, RoiItem>>,
}

impl RoiManager {
    pub fn new() -> Self {
        Self {
            rois: Mutex::new(HashMap::new()),
        }
    }

    pub fn add(&self, mut item: RoiItem, calibration: Option<&SpatialCalibration>) -> RoiItem {
        if item.id.is_empty() {
            item.id = Uuid::new_v4().to_string();
        }

        // Compute baseline measurements
        let cal = calibration.cloned().unwrap_or_default();
        item.measurements = Some(MeasurementEngine::measure(&item.shape, &cal));

        if let Ok(mut map) = self.rois.lock() {
            map.insert(item.id.clone(), item.clone());
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
        if map.contains_key(&item.id) {
            map.insert(item.id.clone(), item.clone());
            Some(item)
        } else {
            None
        }
    }

    pub fn delete(&self, id: &str) -> bool {
        if let Ok(mut map) = self.rois.lock() {
            map.remove(id).is_some()
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

    /// Export ROIs as GeoJSON FeatureCollection (ROI-07)
    pub fn export_geojson(&self, slide_id: Option<&str>) -> Result<String, String> {
        let items = self.list(slide_id);
        let mut features = Vec::new();

        for item in items {
            let (geom_type, coords_json) = match &item.shape {
                RoiShape::Rectangle { x, y, width, height } => (
                    "Polygon",
                    serde_json::json!([[
                        [x, y],
                        [x + width, y],
                        [x + width, y + height],
                        [x, y + height],
                        [x, y]
                    ]]),
                ),
                RoiShape::Polygon { points } => {
                    let mut pts: Vec<Vec<f64>> = points.iter().map(|p| vec![p.x, p.y]).collect();
                    if let Some(first) = pts.first().cloned() {
                        pts.push(first);
                    }
                    ("Polygon", serde_json::json!([pts]))
                }
                RoiShape::Point { point } => ("Point", serde_json::json!([point.x, point.y])),
                RoiShape::Polyline { points } => {
                    let pts: Vec<Vec<f64>> = points.iter().map(|p| vec![p.x, p.y]).collect();
                    ("LineString", serde_json::json!(pts))
                }
                _ => continue,
            };

            let feature = serde_json::json!({
                "type": "Feature",
                "id": item.id,
                "properties": {
                    "name": item.name,
                    "color": item.color,
                    "group": item.group_name,
                    "measurements": item.measurements
                },
                "geometry": {
                    "type": geom_type,
                    "coordinates": coords_json
                }
            });

            features.push(feature);
        }

        let collection = serde_json::json!({
            "type": "FeatureCollection",
            "features": features
        });

        serde_json::to_string_pretty(&collection).map_err(|e| e.to_string())
    }
}
