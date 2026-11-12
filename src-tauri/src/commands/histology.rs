use crate::histology::{HistologyAnalysis, StainVector, HistologyDeconvolutionResult, MorphometryFeature};
use crate::scientific_models::SpatialCalibration;
use tauri::State;
use crate::commands::scientific_image::ScientificWorkspaceState;
use crate::scientific_models::scientific_image::{ImageAsset, TypedPixelBuffer, PixelType, ColorModel};
use uuid::Uuid;

#[tauri::command]
pub fn histo_detect_tissue(
    asset_id: String,
    threshold: Option<u8>,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<ImageAsset, String> {
    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let parent = assets.get(&asset_id).ok_or("Asset not found")?.clone();
    let buffer = parent.buffer.as_ref().ok_or("Buffer not loaded")?;

    let width = parent.dimensions.width as usize;
    let height = parent.dimensions.height as usize;

    let rgb_bytes: Vec<u8> = match buffer {
        TypedPixelBuffer::Rgb24(v) => v.clone(),
        TypedPixelBuffer::Rgba32(v) => {
            let mut out = Vec::with_capacity(width * height * 3);
            for px in v.chunks_exact(4) {
                out.extend_from_slice(&px[0..3]);
            }
            out
        }
        _ => return Err("Tissue detection requires RGB or RGBA image".to_string()),
    };

    let mask = HistologyAnalysis::detect_tissue_mask(&rgb_bytes, width, height, threshold.unwrap_or(235));
    let mask_bytes: Vec<u8> = mask.iter().map(|&t| if t { 255 } else { 0 }).collect();

    let new_id = Uuid::new_v4().to_string();
    let derived = parent.create_derived(
        new_id.clone(),
        format!("{}_TissueMask", parent.asset_name),
        TypedPixelBuffer::U8(mask_bytes),
        PixelType::U8,
        ColorModel::Grayscale,
        "HISTO_TISSUE_MASK",
        serde_json::json!({ "threshold": threshold.unwrap_or(235) }),
    );

    assets.insert(new_id, derived.clone());
    Ok(derived)
}

#[tauri::command]
pub fn histo_deconvolve(
    asset_id: String,
    stains: Vec<StainVector>,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<Vec<HistologyDeconvolutionResult>, String> {
    let assets = state.assets.lock().map_err(|e| e.to_string())?;
    let asset = assets.get(&asset_id).ok_or("Asset not found")?;
    let buffer = asset.buffer.as_ref().ok_or("Buffer not loaded")?;

    let width = asset.dimensions.width as usize;
    let height = asset.dimensions.height as usize;

    let rgb_bytes: Vec<u8> = match buffer {
        TypedPixelBuffer::Rgb24(v) => v.clone(),
        TypedPixelBuffer::Rgba32(v) => {
            let mut out = Vec::with_capacity(width * height * 3);
            for px in v.chunks_exact(4) {
                out.extend_from_slice(&px[0..3]);
            }
            out
        }
        _ => return Err("Deconvolution requires RGB/RGBA image".to_string()),
    };

    HistologyAnalysis::deconvolve(&rgb_bytes, width, height, &stains)
}

#[tauri::command]
pub fn histo_extract_morphometry(
    labels_asset_id: String,
    intensity_asset_id: String,
    calibration: Option<SpatialCalibration>,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<Vec<MorphometryFeature>, String> {
    let assets = state.assets.lock().map_err(|e| e.to_string())?;
    let lbl_asset = assets.get(&labels_asset_id).ok_or("Labels asset not found")?;
    let int_asset = assets.get(&intensity_asset_id).ok_or("Intensity asset not found")?;

    let width = lbl_asset.dimensions.width as usize;
    let height = lbl_asset.dimensions.height as usize;

    let labels: Vec<u32> = match lbl_asset.buffer.as_ref().ok_or("Labels buffer empty")? {
        TypedPixelBuffer::U8(v) => v.iter().map(|&x| x as u32).collect(),
        TypedPixelBuffer::U32(v) => v.clone(),
        _ => return Err("Labels buffer must be U8 or U32".to_string()),
    };

    let intensity: Vec<u8> = match int_asset.buffer.as_ref().ok_or("Intensity buffer empty")? {
        TypedPixelBuffer::U8(v) => v.clone(),
        TypedPixelBuffer::Rgb24(v) => v.chunks_exact(3).map(|c| ((c[0] as u16 + c[1] as u16 + c[2] as u16) / 3) as u8).collect(),
        _ => return Err("Intensity buffer must be U8 or RGB".to_string()),
    };

    Ok(HistologyAnalysis::extract_morphometry(&labels, &intensity, width, height, calibration.as_ref()))
}

