use base64::{engine::general_purpose, Engine as _};
use std::sync::Arc;
use tauri::State;

use crate::wsi::{
    PyramidalSlideReader, TileKey, TileRequest, TileScheduler, ViewportState,
    WsiMetadata, WsiReader, WsiSessionRegistry,
};

#[derive(Default)]
pub struct WsiState {
    pub registry: Arc<WsiSessionRegistry>,
}

#[tauri::command]
pub fn wsi_open_slide(
    path: String,
    tile_size: Option<u32>,
    state: State<'_, WsiState>,
) -> Result<WsiMetadata, String> {
    let size = tile_size.unwrap_or(256).clamp(128, 1024);
    let reader = PyramidalSlideReader::open(&path, size)?;
    let metadata = reader.metadata().clone();
    state.registry.register(Arc::new(reader));
    Ok(metadata)
}

#[tauri::command]
pub fn wsi_get_slide_info(
    slide_id: String,
    state: State<'_, WsiState>,
) -> Result<WsiMetadata, String> {
    let reader = state
        .registry
        .get(&slide_id)
        .ok_or_else(|| format!("Slide with ID '{}' not found", slide_id))?;
    Ok(reader.metadata().clone())
}

#[tauri::command]
pub fn wsi_get_tile(
    slide_id: String,
    level: u32,
    tile_x: u32,
    tile_y: u32,
    state: State<'_, WsiState>,
) -> Result<String, String> {
    let cache_key = TileKey {
        slide_id: slide_id.clone(),
        level,
        tile_x,
        tile_y,
    };

    let cache = state.registry.cache();
    if let Some(cached_data) = cache.get(&cache_key) {
        let b64 = general_purpose::STANDARD.encode(&cached_data);
        return Ok(format!("data:image/jpeg;base64,{}", b64));
    }

    let reader = state
        .registry
        .get(&slide_id)
        .ok_or_else(|| format!("Slide with ID '{}' not found", slide_id))?;

    let jpeg_bytes = reader.read_tile(level, tile_x, tile_y)?;
    cache.insert(cache_key, jpeg_bytes.clone());

    let b64 = general_purpose::STANDARD.encode(&jpeg_bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
pub fn wsi_get_thumbnail(
    slide_id: String,
    max_size: Option<u32>,
    state: State<'_, WsiState>,
) -> Result<String, String> {
    let reader = state
        .registry
        .get(&slide_id)
        .ok_or_else(|| format!("Slide with ID '{}' not found", slide_id))?;

    let size = max_size.unwrap_or(512).clamp(64, 2048);
    let jpeg_bytes = reader.get_thumbnail(size)?;
    let b64 = general_purpose::STANDARD.encode(&jpeg_bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
pub fn wsi_compute_visible_tiles(
    slide_id: String,
    viewport: ViewportState,
    state: State<'_, WsiState>,
) -> Result<Vec<TileRequest>, String> {
    let reader = state
        .registry
        .get(&slide_id)
        .ok_or_else(|| format!("Slide with ID '{}' not found", slide_id))?;

    let levels = &reader.metadata().levels;
    let best_level_idx = TileScheduler::select_best_level(levels, viewport.zoom_level);

    let level_info = levels
        .iter()
        .find(|l| l.level == best_level_idx)
        .ok_or_else(|| "Level not found".to_string())?;

    let requests = TileScheduler::compute_visible_tiles(&viewport, level_info);
    Ok(requests)
}

#[tauri::command]
pub fn wsi_read_region(
    slide_id: String,
    level: u32,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    state: State<'_, WsiState>,
) -> Result<String, String> {
    let reader = state
        .registry
        .get(&slide_id)
        .ok_or_else(|| format!("Slide with ID '{}' not found", slide_id))?;

    let jpeg_bytes = reader.read_region(level, x, y, width, height)?;
    let b64 = general_purpose::STANDARD.encode(&jpeg_bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
pub fn wsi_close_slide(slide_id: String, state: State<'_, WsiState>) -> Result<bool, String> {
    Ok(state.registry.remove(&slide_id))
}
