use crate::ai_segmentation::stardist::StarDistPolygon;
use crate::roi::geometry::Point2D;
use serde::{Deserialize, Serialize};

/// WSI inference tile configuration (options.md DLSEG-02)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TilingConfig {
    pub tile_width: usize,
    pub tile_height: usize,
    pub overlap: usize,
}

impl Default for TilingConfig {
    fn default() -> Self {
        Self {
            tile_width: 1024,
            tile_height: 1024,
            overlap: 128,
        }
    }
}

/// A spatial window on a large WSI slide
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceTileWindow {
    pub tile_id: usize,
    pub x: usize,
    pub y: usize,
    pub width: usize,
    pub height: usize,
}

pub struct WsiTiledInference;

impl WsiTiledInference {
    /// Generates overlapping grid windows spanning the entire WSI dimension
    pub fn plan_tiles(
        image_width: usize,
        image_height: usize,
        config: &TilingConfig,
    ) -> Vec<InferenceTileWindow> {
        let mut tiles = Vec::new();
        if image_width == 0 || image_height == 0 {
            return tiles;
        }

        let step_x = config.tile_width.saturating_sub(config.overlap).max(1);
        let step_y = config.tile_height.saturating_sub(config.overlap).max(1);

        let mut tile_id = 0;
        let mut y = 0;
        while y < image_height {
            let h = (config.tile_height).min(image_height - y);
            let mut x = 0;
            while x < image_width {
                let w = (config.tile_width).min(image_width - x);
                tiles.push(InferenceTileWindow {
                    tile_id,
                    x,
                    y,
                    width: w,
                    height: h,
                });
                tile_id += 1;
                x += step_x;
            }
            y += step_y;
        }

        tiles
    }

    /// Translates local polygon detections within a tile to absolute slide/WSI coordinates
    pub fn translate_polygons_to_slide(
        polygons: &[StarDistPolygon],
        tile: &InferenceTileWindow,
    ) -> Vec<StarDistPolygon> {
        polygons
            .iter()
            .map(|poly| {
                let offset_x = tile.x as f64;
                let offset_y = tile.y as f64;

                let global_vertices = poly
                    .vertices
                    .iter()
                    .map(|p| Point2D {
                        x: p.x + offset_x,
                        y: p.y + offset_y,
                    })
                    .collect();

                let (min_x, min_y, max_x, max_y) = poly.bbox;

                StarDistPolygon {
                    id: poly.id,
                    center_x: poly.center_x + offset_x,
                    center_y: poly.center_y + offset_y,
                    probability: poly.probability,
                    vertices: global_vertices,
                    bbox: (
                        min_x + offset_x,
                        min_y + offset_y,
                        max_x + offset_x,
                        max_y + offset_y,
                    ),
                    area: poly.area,
                }
            })
            .collect()
    }

    /// Global Non-Maximum Suppression to deduplicate nuclei detected across overlapping tile margins
    pub fn deduplicate_global_polygons(
        mut polygons: Vec<StarDistPolygon>,
        nms_threshold: f64,
    ) -> Vec<StarDistPolygon> {
        polygons.sort_by(|a, b| {
            b.probability
                .partial_cmp(&a.probability)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let mut keep = Vec::new();
        let mut suppressed = vec![false; polygons.len()];

        for i in 0..polygons.len() {
            if suppressed[i] {
                continue;
            }

            let mut poly = polygons[i].clone();
            poly.id = keep.len() + 1;
            keep.push(poly);

            for j in (i + 1)..polygons.len() {
                if suppressed[j] {
                    continue;
                }

                // Quick bounding box distance check before IoU
                let dx = (polygons[i].center_x - polygons[j].center_x).abs();
                let dy = (polygons[i].center_y - polygons[j].center_y).abs();
                if dx > 150.0 || dy > 150.0 {
                    continue;
                }

                let iou = polygons[i].bbox_iou(&polygons[j]);
                if iou > nms_threshold {
                    suppressed[j] = true;
                }
            }
        }

        keep
    }
}
