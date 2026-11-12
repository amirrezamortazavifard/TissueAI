use crate::ai_segmentation::{
    InferenceTileWindow, StarDistDecoder, StarDistPolygon, TilingConfig, WsiTiledInference,
};
use crate::roi::geometry::RoiShape;
use crate::roi::manager::RoiItem;
use crate::roi::measurement::MeasurementEngine;
use crate::scientific_models::scientific_image::SpatialCalibration;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct StarDistDecodeParams {
    pub prob: Vec<f32>,
    pub distances: Vec<f32>,
    pub width: usize,
    pub height: usize,
    pub n_rays: usize,
    pub prob_threshold: f32,
    pub nms_threshold: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WsiTilingParams {
    pub image_width: usize,
    pub image_height: usize,
    pub tile_width: usize,
    pub tile_height: usize,
    pub overlap: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PolygonsToRoisParams {
    pub polygons: Vec<StarDistPolygon>,
    pub slide_id: String,
    pub pixel_size_um: f64,
}

#[tauri::command]
pub fn ai_stardist_decode(params: StarDistDecodeParams) -> Result<Vec<StarDistPolygon>, String> {
    let polygons = StarDistDecoder::decode(
        &params.prob,
        &params.distances,
        params.width,
        params.height,
        params.n_rays,
        params.prob_threshold,
        params.nms_threshold,
    );
    Ok(polygons)
}

#[tauri::command]
pub fn ai_wsi_plan_tiles(params: WsiTilingParams) -> Result<Vec<InferenceTileWindow>, String> {
    let config = TilingConfig {
        tile_width: params.tile_width,
        tile_height: params.tile_height,
        overlap: params.overlap,
    };
    let tiles = WsiTiledInference::plan_tiles(params.image_width, params.image_height, &config);
    Ok(tiles)
}

#[tauri::command]
pub fn ai_stardist_to_rois(params: PolygonsToRoisParams) -> Result<Vec<RoiItem>, String> {
    let mut rois = Vec::with_capacity(params.polygons.len());
    let px_scale = if params.pixel_size_um > 0.0 {
        params.pixel_size_um
    } else {
        1.0
    };
    let calib = SpatialCalibration::new_microns(px_scale);

    for poly in params.polygons {
        let shape = RoiShape::Polygon {
            points: poly.vertices,
        };
        let measurements = MeasurementEngine::measure(&shape, &calib);
        let roi = RoiItem {
            id: Uuid::new_v4().to_string(),
            name: format!("Nucleus #{}", poly.id),
            shape,
            color: "#4ade80".to_string(),
            group_name: "AI StarDist Nuclei".to_string(),
            slide_id: Some(params.slide_id.clone()),
            is_visible: true,
            measurements: Some(measurements),
        };
        rois.push(roi);
    }

    Ok(rois)
}
