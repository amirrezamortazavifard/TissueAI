use super::geometry::{GeometryEngine, RoiShape};
use crate::scientific_models::scientific_image::SpatialCalibration;
use serde::{Deserialize, Serialize};

/// Comprehensive scientific ROI measurements (ANA-01, ANA-02, ANA-03)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RoiMeasurements {
    pub area_px: f64,
    pub area_physical: f64,
    pub perimeter_px: f64,
    pub perimeter_physical: f64,
    pub circularity: f64,
    pub aspect_ratio: f64,
    pub feret_max_physical: f64,
    pub feret_min_physical: f64,
    pub centroid_x_physical: f64,
    pub centroid_y_physical: f64,
    pub unit_name: String,
    pub is_calibrated: bool,
    // Pixel intensity metrics (if image buffer was evaluated)
    pub mean_intensity: Option<f64>,
    pub min_intensity: Option<f64>,
    pub max_intensity: Option<f64>,
    pub std_dev_intensity: Option<f64>,
}

pub struct MeasurementEngine;

impl MeasurementEngine {
    pub fn measure(
        shape: &RoiShape,
        calibration: &SpatialCalibration,
    ) -> RoiMeasurements {
        let metrics = GeometryEngine::compute_shape_metrics(shape);

        let area_phys = calibration.calculate_calibrated_area(metrics.area_px);
        let perim_phys = metrics.perimeter_px * calibration.pixel_size_x;
        let feret_max_phys = metrics.feret_max_px * calibration.pixel_size_x;
        let feret_min_phys = metrics.feret_min_px * calibration.pixel_size_x;

        let (cx_phys, cy_phys) = calibration.pixel_to_physical(metrics.centroid.x, metrics.centroid.y);

        RoiMeasurements {
            area_px: metrics.area_px,
            area_physical: area_phys,
            perimeter_px: metrics.perimeter_px,
            perimeter_physical: perim_phys,
            circularity: metrics.circularity,
            aspect_ratio: metrics.aspect_ratio,
            feret_max_physical: feret_max_phys,
            feret_min_physical: feret_min_phys,
            centroid_x_physical: cx_phys,
            centroid_y_physical: cy_phys,
            unit_name: calibration.unit_name.clone(),
            is_calibrated: calibration.is_calibrated,
            mean_intensity: None,
            min_intensity: None,
            max_intensity: None,
            std_dev_intensity: None,
        }
    }
}
