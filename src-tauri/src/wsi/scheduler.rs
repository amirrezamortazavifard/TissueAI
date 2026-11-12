use super::reader::PyramidLevel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewportState {
    pub center_x: f64, // Level-0 slide coordinates
    pub center_y: f64,
    pub zoom_level: f64, // 1.0 = 40x (1:1), 0.5 = 20x, 0.25 = 10x, etc.
    pub viewport_width: u32,
    pub viewport_height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileRequest {
    pub level: u32,
    pub tile_x: u32,
    pub tile_y: u32,
    pub priority: u32,
}

/// Viewport tile calculation and spatial coordinate scheduler (WSI-03, WSI-06)
pub struct TileScheduler;

impl TileScheduler {
    /// Find best matching pyramid level for current zoom
    pub fn select_best_level(levels: &[PyramidLevel], zoom: f64) -> u32 {
        if levels.is_empty() {
            return 0;
        }

        let target_downsample = 1.0 / zoom.max(0.01);
        let mut best_level = 0;
        let mut min_diff = f64::MAX;

        for level in levels {
            let diff = (level.downsample - target_downsample).abs();
            if diff < min_diff {
                min_diff = diff;
                best_level = level.level;
            }
        }

        best_level
    }

    /// Compute needed tiles for a visible viewport
    pub fn compute_visible_tiles(
        viewport: &ViewportState,
        level_info: &PyramidLevel,
    ) -> Vec<TileRequest> {
        let half_w_level0 = (viewport.viewport_width as f64 / (2.0 * viewport.zoom_level)).max(1.0);
        let half_h_level0 = (viewport.viewport_height as f64 / (2.0 * viewport.zoom_level)).max(1.0);

        let min_x_l0 = (viewport.center_x - half_w_level0).max(0.0);
        let max_x_l0 = viewport.center_x + half_w_level0;
        let min_y_l0 = (viewport.center_y - half_h_level0).max(0.0);
        let max_y_l0 = viewport.center_y + half_h_level0;

        let downsample = level_info.downsample;
        let tile_size_l0 = level_info.tile_width as f64 * downsample;

        let start_tile_x = (min_x_l0 / tile_size_l0).floor() as u32;
        let end_tile_x = ((max_x_l0 / tile_size_l0).ceil() as u32).min(level_info.num_tiles_x);

        let start_tile_y = (min_y_l0 / tile_size_l0).floor() as u32;
        let end_tile_y = ((max_y_l0 / tile_size_l0).ceil() as u32).min(level_info.num_tiles_y);

        let center_tile_x = (viewport.center_x / tile_size_l0) as f64;
        let center_tile_y = (viewport.center_y / tile_size_l0) as f64;

        let mut requests = Vec::new();
        for ty in start_tile_y..end_tile_y {
            for tx in start_tile_x..end_tile_x {
                let dx = tx as f64 - center_tile_x;
                let dy = ty as f64 - center_tile_y;
                let dist_sq = (dx * dx + dy * dy) as u32;

                requests.push(TileRequest {
                    level: level_info.level,
                    tile_x: tx,
                    tile_y: ty,
                    priority: dist_sq, // lower distance = higher priority
                });
            }
        }

        // Sort so tiles closest to center load first
        requests.sort_by_key(|r| r.priority);
        requests
    }

    /// Convert screen viewport (x, y) to Level-0 slide coordinates
    pub fn screen_to_slide(
        screen_x: f64,
        screen_y: f64,
        viewport: &ViewportState,
    ) -> (f64, f64) {
        let center_screen_x = viewport.viewport_width as f64 / 2.0;
        let center_screen_y = viewport.viewport_height as f64 / 2.0;

        let delta_screen_x = screen_x - center_screen_x;
        let delta_screen_y = screen_y - center_screen_y;

        let slide_x = viewport.center_x + (delta_screen_x / viewport.zoom_level);
        let slide_y = viewport.center_y + (delta_screen_y / viewport.zoom_level);

        (slide_x, slide_y)
    }
}

