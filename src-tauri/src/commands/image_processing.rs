use crate::commands::scientific_image::ScientificWorkspaceState;
use crate::image_processing::{Adjustments, DistanceTransform, Filters, Watershed};
use crate::scientific_models::scientific_image::{
    ColorModel, ImageAsset, PixelType, TypedPixelBuffer,
};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatershedResult {
    pub labeled_asset_id: String,
    pub cell_count: u32,
    pub execution_time_ms: u64,
}

#[tauri::command]
pub fn proc_apply_filter(
    asset_id: String,
    filter_name: String,
    param: f32,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<ImageAsset, String> {
    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let parent = assets
        .get(&asset_id)
        .ok_or_else(|| format!("Asset '{}' not found", asset_id))?
        .clone();

    let buffer = parent
        .buffer
        .as_ref()
        .ok_or_else(|| "Parent buffer not loaded".to_string())?;

    let width = parent.dimensions.width as usize;
    let height = parent.dimensions.height as usize;
    let channels = parent.dimensions.channels as usize;

    let (raw_data, pixel_type, color_model) = match buffer {
        TypedPixelBuffer::U8(v) => (v.clone(), PixelType::U8, ColorModel::Grayscale),
        TypedPixelBuffer::Rgb24(v) => (v.clone(), PixelType::Rgb24, ColorModel::Rgb),
        TypedPixelBuffer::Rgba32(v) => (v.clone(), PixelType::Rgba32, ColorModel::Rgb),
        _ => return Err("Filter only supports U8 and RGB byte buffers".to_string()),
    };

    let filtered_bytes = match filter_name.to_lowercase().as_str() {
        "gaussian" | "blur" => Filters::gaussian_blur(&raw_data, width, height, channels, param),
        "median" => Filters::median_filter(&raw_data, width, height, channels, param.round() as usize),
        _ => return Err(format!("Unsupported filter: {}", filter_name)),
    };

    let new_id = Uuid::new_v4().to_string();
    let new_name = format!("{}_{}", parent.asset_name, filter_name);
    let new_buffer = match pixel_type {
        PixelType::U8 => TypedPixelBuffer::U8(filtered_bytes),
        PixelType::Rgb24 => TypedPixelBuffer::Rgb24(filtered_bytes),
        _ => TypedPixelBuffer::Rgba32(filtered_bytes),
    };

    let derived = parent.create_derived(
        new_id.clone(),
        new_name,
        new_buffer,
        pixel_type,
        color_model,
        &format!("FILTER_{}", filter_name.to_uppercase()),
        serde_json::json!({ "param": param }),
    );

    assets.insert(new_id, derived.clone());
    Ok(derived)
}

#[tauri::command]
pub fn proc_apply_adjustments(
    asset_id: String,
    contrast: f32,
    brightness: f32,
    gamma: f32,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<ImageAsset, String> {
    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let parent = assets
        .get(&asset_id)
        .ok_or_else(|| format!("Asset '{}' not found", asset_id))?
        .clone();

    let buffer = parent
        .buffer
        .as_ref()
        .ok_or_else(|| "Parent buffer not loaded".to_string())?;

    let (raw_data, pixel_type, color_model) = match buffer {
        TypedPixelBuffer::U8(v) => (v.clone(), PixelType::U8, ColorModel::Grayscale),
        TypedPixelBuffer::Rgb24(v) => (v.clone(), PixelType::Rgb24, ColorModel::Rgb),
        TypedPixelBuffer::Rgba32(v) => (v.clone(), PixelType::Rgba32, ColorModel::Rgb),
        _ => return Err("Adjustments only support U8 and RGB byte buffers".to_string()),
    };

    let mut adjusted = Adjustments::brightness_contrast(&raw_data, contrast, brightness);
    if (gamma - 1.0).abs() > 0.01 && gamma > 0.0 {
        adjusted = Adjustments::gamma(&adjusted, gamma);
    }

    let new_id = Uuid::new_v4().to_string();
    let new_name = format!("{}_adjusted", parent.asset_name);
    let new_buffer = match pixel_type {
        PixelType::U8 => TypedPixelBuffer::U8(adjusted),
        PixelType::Rgb24 => TypedPixelBuffer::Rgb24(adjusted),
        _ => TypedPixelBuffer::Rgba32(adjusted),
    };

    let derived = parent.create_derived(
        new_id.clone(),
        new_name,
        new_buffer,
        pixel_type,
        color_model,
        "ADJUSTMENTS",
        serde_json::json!({ "contrast": contrast, "brightness": brightness, "gamma": gamma }),
    );

    assets.insert(new_id, derived.clone());
    Ok(derived)
}

#[tauri::command]
pub fn proc_distance_transform(
    asset_id: String,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<ImageAsset, String> {
    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let parent = assets
        .get(&asset_id)
        .ok_or_else(|| format!("Asset '{}' not found", asset_id))?
        .clone();

    let buffer = parent
        .buffer
        .as_ref()
        .ok_or_else(|| "Parent buffer not loaded".to_string())?;

    let width = parent.dimensions.width as usize;
    let height = parent.dimensions.height as usize;

    let mask: Vec<bool> = match buffer {
        TypedPixelBuffer::U8(v) => v.iter().map(|&p| p > 128).collect(),
        _ => return Err("Distance transform requires a single-channel binary/U8 mask".to_string()),
    };

    let dist = DistanceTransform::compute_edt(&mask, width, height);
    let new_id = Uuid::new_v4().to_string();
    let new_name = format!("{}_EDT", parent.asset_name);

    let derived = parent.create_derived(
        new_id.clone(),
        new_name,
        TypedPixelBuffer::F32(dist),
        PixelType::F32,
        ColorModel::Grayscale,
        "SEG_05_EDT",
        serde_json::json!({ "method": "EuclideanDistanceTransform" }),
    );

    assets.insert(new_id, derived.clone());
    Ok(derived)
}

#[tauri::command]
pub fn proc_watershed_segmentation(
    asset_id: String,
    min_seed_distance: Option<f32>,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<WatershedResult, String> {
    let start = Instant::now();
    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let parent = assets
        .get(&asset_id)
        .ok_or_else(|| format!("Asset '{}' not found", asset_id))?
        .clone();

    let buffer = parent
        .buffer
        .as_ref()
        .ok_or_else(|| "Parent buffer not loaded".to_string())?;

    let width = parent.dimensions.width as usize;
    let height = parent.dimensions.height as usize;

    let mask: Vec<bool> = match buffer {
        TypedPixelBuffer::U8(v) => v.iter().map(|&p| p > 128).collect(),
        _ => return Err("Watershed requires a binary/U8 mask".to_string()),
    };

    let dist = DistanceTransform::compute_edt(&mask, width, height);
    let seed_dist = min_seed_distance.unwrap_or(3.0).max(1.0);

    let (labels, cell_count) = Watershed::segment(&mask, &dist, width, height, seed_dist);

    // Convert labels to 8-bit visualization mask
    let mut vis_mask = vec![0u8; width * height];
    for (i, &lbl) in labels.iter().enumerate() {
        if lbl > 0 {
            vis_mask[i] = ((lbl % 254) + 1) as u8;
        }
    }

    let new_id = Uuid::new_v4().to_string();
    let new_name = format!("{}_Watershed", parent.asset_name);

    let derived = parent.create_derived(
        new_id.clone(),
        new_name,
        TypedPixelBuffer::U8(vis_mask),
        PixelType::U8,
        ColorModel::Indexed,
        "SEG_06_WATERSHED",
        serde_json::json!({
            "min_seed_distance": seed_dist,
            "segmented_cells": cell_count
        }),
    );

    assets.insert(new_id.clone(), derived);

    Ok(WatershedResult {
        labeled_asset_id: new_id,
        cell_count,
        execution_time_ms: start.elapsed().as_millis() as u64,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThresholdResult {
    pub threshold_value: u8,
    pub binary_asset_id: String,
    pub foreground_count: usize,
}

#[tauri::command]
pub fn proc_apply_threshold(
    asset_id: String,
    method: String,
    fixed_value: Option<f64>,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<ThresholdResult, String> {
    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let parent = assets
        .get(&asset_id)
        .ok_or_else(|| format!("Asset '{}' not found", asset_id))?
        .clone();

    let buffer = parent
        .buffer
        .as_ref()
        .ok_or_else(|| "Parent buffer not loaded".to_string())?;

    let width = parent.dimensions.width as usize;
    let height = parent.dimensions.height as usize;

    let grayscale_bytes: Vec<u8> = match buffer {
        TypedPixelBuffer::U8(v) => v.clone(),
        TypedPixelBuffer::Rgb24(v) => {
            v.chunks_exact(3)
                .map(|rgb| (0.299 * rgb[0] as f32 + 0.587 * rgb[1] as f32 + 0.114 * rgb[2] as f32).round() as u8)
                .collect()
        }
        TypedPixelBuffer::Rgba32(v) => {
            v.chunks_exact(4)
                .map(|rgba| (0.299 * rgba[0] as f32 + 0.587 * rgba[1] as f32 + 0.114 * rgba[2] as f32).round() as u8)
                .collect()
        }
        _ => return Err("Thresholding requires a U8, RGB, or RGBA buffer".to_string()),
    };

    let thresh_method = match method.to_lowercase().as_str() {
        "otsu" => crate::image_processing::ThresholdMethod::Otsu,
        "triangle" => crate::image_processing::ThresholdMethod::Triangle,
        "mean" => crate::image_processing::ThresholdMethod::Mean,
        "fixed" => crate::image_processing::ThresholdMethod::Fixed(fixed_value.unwrap_or(128.0)),
        _ => return Err(format!("Unknown threshold method: {}", method)),
    };

    let (mask, cutoff) = crate::image_processing::Thresholding::apply(&grayscale_bytes, thresh_method);
    let binary_bytes: Vec<u8> = mask.iter().map(|&fg| if fg { 255 } else { 0 }).collect();
    let foreground_count = mask.iter().filter(|&&fg| fg).count();

    let new_id = Uuid::new_v4().to_string();
    let new_name = format!("{}_Threshold_{}", parent.asset_name, method);

    let derived = parent.create_derived(
        new_id.clone(),
        new_name,
        TypedPixelBuffer::U8(binary_bytes),
        PixelType::U8,
        ColorModel::Grayscale,
        &format!("THRESHOLD_{}", method.to_uppercase()),
        serde_json::json!({
            "cutoff": cutoff,
            "foreground_pixels": foreground_count,
            "method": method,
        }),
    );

    assets.insert(new_id.clone(), derived);

    Ok(ThresholdResult {
        threshold_value: cutoff,
        binary_asset_id: new_id,
        foreground_count,
    })
}


