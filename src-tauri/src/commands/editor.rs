use image::{DynamicImage, Rgba, RgbaImage};
use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Mutex;
use tauri::State;

const MAX_HISTORY: usize = 50;

#[derive(Default)]
pub struct EditorState {
    pub current_image: Mutex<Option<RgbaImage>>,
    pub history: Mutex<VecDeque<EditorHistoryItem>>,
    pub redo_stack: Mutex<VecDeque<EditorHistoryItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorHistoryItem {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorImageInfo {
    pub width: u32,
    pub height: u32,
    pub base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PixelColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CropResult {
    pub width: u32,
    pub height: u32,
    pub base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotateResult {
    pub width: u32,
    pub height: u32,
    pub base64: String,
}

fn save_state(state: &EditorState) {
    if let Some(img) = state.current_image.lock().unwrap().as_ref() {
        let item = EditorHistoryItem {
            width: img.width(),
            height: img.height(),
            pixels: img.clone().into_raw(),
        };
        let mut history = state.history.lock().unwrap();
        if history.len() >= MAX_HISTORY {
            history.pop_front();
        }
        history.push_back(item);
    }
    state.redo_stack.lock().unwrap().clear();
}

fn img_to_base64(img: &RgbaImage) -> Result<String, String> {
    let dynamic = DynamicImage::ImageRgba8(img.clone());
    let mut buf = std::io::Cursor::new(Vec::new());
    dynamic.write_to(&mut buf, image::ImageFormat::Png).map_err(|e| e.to_string())?;
    use base64::Engine;
    Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(buf.into_inner())))
}

#[tauri::command]
pub async fn load_editor_image(path: String, state: State<'_, EditorState>) -> Result<EditorImageInfo, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let (w, h) = (rgba.width(), rgba.height());
    let base64 = img_to_base64(&rgba)?;

    *state.current_image.lock().unwrap() = Some(rgba);
    state.history.lock().unwrap().clear();
    state.redo_stack.lock().unwrap().clear();
    save_state(&state);

    Ok(EditorImageInfo { width: w, height: h, base64 })
}

#[tauri::command]
pub async fn get_editor_image_base64(state: State<'_, EditorState>) -> Result<String, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    img_to_base64(&img)
}

#[tauri::command]
pub async fn get_pixel_color(
    x: u32,
    y: u32,
    state: State<'_, EditorState>,
) -> Result<PixelColor, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    if x >= img.width() || y >= img.height() {
        return Err("Coordinates out of bounds".to_string());
    }
    let pixel = img.get_pixel(x, y);
    Ok(PixelColor { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] })
}

#[tauri::command]
pub async fn flood_fill(
    start_x: i32,
    start_y: i32,
    fill_r: u8,
    fill_g: u8,
    fill_b: u8,
    fill_a: u8,
    tolerance: u8,
    state: State<'_, EditorState>,
) -> Result<String, String> {
    let mut img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width() as i32;
    let height = img.height() as i32;

    if start_x < 0 || start_x >= width || start_y < 0 || start_y >= height {
        return Err("Start coordinates out of bounds".to_string());
    }

    let target = *img.get_pixel(start_x as u32, start_y as u32);
    let fill_color = Rgba([fill_r, fill_g, fill_b, fill_a]);

    if target == fill_color {
        return img_to_base64(&img);
    }

    let tol = tolerance as i32;
    let mut visited = vec![false; (width * height) as usize];
    let mut queue = VecDeque::new();
    queue.push_back((start_x, start_y));
    visited[(start_y * width + start_x) as usize] = true;

    while let Some((x, y)) = queue.pop_front() {
        let pixel = *img.get_pixel(x as u32, y as u32);
        let dr = pixel[0] as i32 - target[0] as i32;
        let dg = pixel[1] as i32 - target[1] as i32;
        let db = pixel[2] as i32 - target[2] as i32;
        let da = pixel[3] as i32 - target[3] as i32;

        if dr.abs() <= tol && dg.abs() <= tol && db.abs() <= tol && da.abs() <= tol {
            img.put_pixel(x as u32, y as u32, fill_color);

            for &(dx, dy) in &[(0, 1), (0, -1), (1, 0), (-1, 0)] {
                let nx = x + dx;
                let ny = y + dy;
                if nx >= 0 && nx < width && ny >= 0 && ny < height {
                    let nidx = (ny * width + nx) as usize;
                    if !visited[nidx] {
                        visited[nidx] = true;
                        queue.push_back((nx, ny));
                    }
                }
            }
        }
    }

    save_state(&state);
    img_to_base64(&img)
}

#[tauri::command]
pub async fn crop_image(
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    state: State<'_, EditorState>,
) -> Result<CropResult, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;

    let crop_x = x.min(img.width() - 1);
    let crop_y = y.min(img.height() - 1);
    let crop_w = width.min(img.width() - crop_x);
    let crop_h = height.min(img.height() - crop_y);

    if crop_w == 0 || crop_h == 0 {
        return Err("Invalid crop dimensions".to_string());
    }

    let mut dynamic = DynamicImage::ImageRgba8(img);
    let cropped_dynamic = dynamic.crop(crop_x, crop_y, crop_w, crop_h);
    let cropped = cropped_dynamic.to_rgba8();
    let base64 = img_to_base64(&cropped)?;

    *state.current_image.lock().unwrap() = Some(cropped);
    save_state(&state);

    Ok(CropResult { width: crop_w, height: crop_h, base64 })
}

#[tauri::command]
pub async fn rotate_image(
    degrees: f64,
    state: State<'_, EditorState>,
) -> Result<RotateResult, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width();
    let height = img.height();

    let rad = degrees * std::f64::consts::PI / 180.0;
    let cos_theta = rad.cos();
    let sin_theta = rad.sin();

    let cx = width as f64 / 2.0;
    let cy = height as f64 / 2.0;

    let new_width = (width as f64 * cos_theta.abs() + height as f64 * sin_theta.abs()) as u32;
    let new_height = (width as f64 * sin_theta.abs() + height as f64 * cos_theta.abs()) as u32;

    let new_cx = new_width as f64 / 2.0;
    let new_cy = new_height as f64 / 2.0;

    let mut rotated = RgbaImage::new(new_width, new_height);
    let background = Rgba([0, 0, 0, 0]);

    for y in 0..new_height {
        for x in 0..new_width {
            let dx = x as f64 - new_cx;
            let dy = y as f64 - new_cy;

            let src_x = dx * cos_theta + dy * sin_theta + cx;
            let src_y = -dx * sin_theta + dy * cos_theta + cy;

            if src_x >= 0.0 && src_x < width as f64 && src_y >= 0.0 && src_y < height as f64 {
                let src_x_u = src_x as u32;
                let src_y_u = src_y as u32;
                let pixel = *img.get_pixel(src_x_u.min(width - 1), src_y_u.min(height - 1));
                rotated.put_pixel(x, y, pixel);
            } else {
                rotated.put_pixel(x, y, background);
            }
        }
    }

    let (w, h) = (rotated.width(), rotated.height());
    let base64 = img_to_base64(&rotated)?;

    *state.current_image.lock().unwrap() = Some(rotated);
    save_state(&state);

    Ok(RotateResult { width: w, height: h, base64 })
}

#[tauri::command]
pub async fn apply_scale_bar(
    length_um: f64,
    pixels_per_um: f64,
    position: String,
    state: State<'_, EditorState>,
) -> Result<String, String> {
    let mut img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width();
    let height = img.height();

    let bar_length_pixels = (length_um * pixels_per_um) as u32;
    if bar_length_pixels == 0 || bar_length_pixels >= width {
        return Err("Invalid scale bar length".to_string());
    }

    let (bar_x, bar_y) = match position.as_str() {
        "bottom-right" => (width - bar_length_pixels - 20, height - 40),
        "bottom-left" => (20, height - 40),
        "top-right" => (width - bar_length_pixels - 20, 20),
        "top-left" => (20, 20),
        _ => (width - bar_length_pixels - 20, height - 40),
    };

    let bar_height = 4u32;
    let white = Rgba([255u8, 255, 255, 255]);
    let black = Rgba([0u8, 0, 0, 255]);

    for dy in 0..bar_height {
        for dx in 0..bar_length_pixels {
            let px = bar_x + dx;
            let py = bar_y + dy;
            if px < width && py < height {
                img.put_pixel(px, py, black);
            }
        }
    }

    for dx in 0..bar_length_pixels {
        let px = bar_x + dx;
        if px < width && bar_y < height {
            img.put_pixel(px, bar_y, white);
        }
    }

    for dy in 0..bar_height {
        let py = bar_y + dy;
        if bar_x < width && py < height {
            img.put_pixel(bar_x, py, white);
        }
        if bar_x + bar_length_pixels - 1 < width && py < height {
            img.put_pixel(bar_x + bar_length_pixels - 1, py, white);
        }
    }

    save_state(&state);
    img_to_base64(&img)
}

#[tauri::command]
pub async fn undo_editor(state: State<'_, EditorState>) -> Result<String, String> {
    let mut history = state.history.lock().unwrap();
    if history.len() > 1 {
        let current = history.pop_back().unwrap();
        state.redo_stack.lock().unwrap().push_back(current);

        let previous = history.back().unwrap().clone();
        let img = RgbaImage::from_raw(previous.width, previous.height, previous.pixels)
            .ok_or("Failed to reconstruct image")?;
        *state.current_image.lock().unwrap() = Some(img.clone());
        return img_to_base64(&img);
    }
    Err("Nothing to undo".to_string())
}

#[tauri::command]
pub async fn redo_editor(state: State<'_, EditorState>) -> Result<String, String> {
    let mut redo = state.redo_stack.lock().unwrap();
    if let Some(item) = redo.pop_back() {
        let img = RgbaImage::from_raw(item.width, item.height, item.pixels)
            .ok_or("Failed to reconstruct image")?;
        *state.current_image.lock().unwrap() = Some(img.clone());

        let mut history = state.history.lock().unwrap();
        let redo_item = EditorHistoryItem {
            width: img.width(),
            height: img.height(),
            pixels: img.clone().into_raw(),
        };
        if history.len() >= MAX_HISTORY {
            history.pop_front();
        }
        history.push_back(redo_item);

        return img_to_base64(&img);
    }
    Err("Nothing to redo".to_string())
}

#[tauri::command]
pub async fn save_editor_image(
    path: String,
    base64_data: Option<String>,
    state: State<'_, EditorState>,
) -> Result<(), String> {
    let rgba = if let Some(ref data_str) = base64_data {
        let data = data_str
            .strip_prefix("data:image/png;base64,")
            .or_else(|| data_str.strip_prefix("data:image/jpeg;base64,"))
            .unwrap_or(data_str);

        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| e.to_string())?;

        let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
        img.to_rgba8()
    } else {
        state.current_image.lock().unwrap().clone().ok_or("No image loaded")?
    };

    let dynamic = DynamicImage::ImageRgba8(rgba);
    dynamic.save(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_image_from_canvas(
    base64_data: String,
    state: State<'_, EditorState>,
) -> Result<(), String> {
    let data = base64_data
        .strip_prefix("data:image/png;base64,")
        .or_else(|| base64_data.strip_prefix("data:image/jpeg;base64,"))
        .unwrap_or(&base64_data);

    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| e.to_string())?;

    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();

    *state.current_image.lock().unwrap() = Some(rgba);
    save_state(&state);
    Ok(())
}

#[tauri::command]
pub async fn get_image_dimensions(state: State<'_, EditorState>) -> Result<(u32, u32), String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    Ok((img.width(), img.height()))
}

#[tauri::command]
pub async fn flip_image(
    direction: String,
    state: State<'_, EditorState>,
) -> Result<EditorImageInfo, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let flipped = match direction.as_str() {
        "horizontal" => image::imageops::flip_horizontal(&img),
        "vertical" => image::imageops::flip_vertical(&img),
        _ => return Err("Invalid direction".to_string()),
    };
    let (w, h) = (flipped.width(), flipped.height());
    let base64 = img_to_base64(&flipped)?;
    *state.current_image.lock().unwrap() = Some(flipped);
    save_state(&state);
    Ok(EditorImageInfo { width: w, height: h, base64 })
}

#[tauri::command]
pub async fn rotate_90(
    direction: String,
    state: State<'_, EditorState>,
) -> Result<EditorImageInfo, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let rotated = match direction.as_str() {
        "left" => image::imageops::rotate90(&img),
        "right" => image::imageops::rotate270(&img),
        _ => return Err("Invalid direction".to_string()),
    };
    let (w, h) = (rotated.width(), rotated.height());
    let base64 = img_to_base64(&rotated)?;
    *state.current_image.lock().unwrap() = Some(rotated);
    save_state(&state);
    Ok(EditorImageInfo { width: w, height: h, base64 })
}

#[tauri::command]
pub async fn resize_image(
    new_width: u32,
    new_height: u32,
    state: State<'_, EditorState>,
) -> Result<EditorImageInfo, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    if new_width == 0 || new_height == 0 {
        return Err("Invalid dimensions".to_string());
    }
    let dynamic = DynamicImage::ImageRgba8(img);
    let resized = dynamic.resize_exact(new_width, new_height, FilterType::Lanczos3);
    let resized = resized.to_rgba8();
    let (w, h) = (resized.width(), resized.height());
    let base64 = img_to_base64(&resized)?;
    *state.current_image.lock().unwrap() = Some(resized);
    save_state(&state);
    Ok(EditorImageInfo { width: w, height: h, base64 })
}

#[tauri::command]
pub async fn resize_canvas(
    new_width: u32,
    new_height: u32,
    bg_r: u8,
    bg_g: u8,
    bg_b: u8,
    bg_a: u8,
    state: State<'_, EditorState>,
) -> Result<EditorImageInfo, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    if new_width == 0 || new_height == 0 {
        return Err("Invalid dimensions".to_string());
    }
    let mut new_img = RgbaImage::new(new_width, new_height);
    let bg = Rgba([bg_r, bg_g, bg_b, bg_a]);
    for y in 0..new_height {
        for x in 0..new_width {
            new_img.put_pixel(x, y, bg);
        }
    }
    let copy_w = new_width.min(img.width());
    let copy_h = new_height.min(img.height());
    for y in 0..copy_h {
        for x in 0..copy_w {
            let pixel = *img.get_pixel(x, y);
            new_img.put_pixel(x, y, pixel);
        }
    }
    let (w, h) = (new_img.width(), new_img.height());
    let base64 = img_to_base64(&new_img)?;
    *state.current_image.lock().unwrap() = Some(new_img);
    save_state(&state);
    Ok(EditorImageInfo { width: w, height: h, base64 })
}

#[tauri::command]
pub async fn create_new_canvas(
    width: u32,
    height: u32,
    bg_hex: String,
    state: State<'_, EditorState>,
) -> Result<EditorImageInfo, String> {
    if width == 0 || height == 0 {
        return Err("Invalid dimensions".to_string());
    }
    let bg = if bg_hex == "transparent" {
        Rgba([0, 0, 0, 0])
    } else {
        let hex = bg_hex.trim_start_matches('#');
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(255);
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(255);
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(255);
        Rgba([r, g, b, 255])
    };
    let mut img = RgbaImage::new(width, height);
    for y in 0..height {
        for x in 0..width {
            img.put_pixel(x, y, bg);
        }
    }
    let base64 = img_to_base64(&img)?;
    *state.current_image.lock().unwrap() = Some(img);
    state.history.lock().unwrap().clear();
    state.redo_stack.lock().unwrap().clear();
    save_state(&state);
    Ok(EditorImageInfo { width, height, base64 })
}

#[tauri::command]
pub async fn get_system_fonts() -> Result<Vec<String>, String> {
    let mut fonts: Vec<String> = Vec::new();
    if let Some(font_dirs) = dirs_next::font_dir() {
        if let Ok(entries) = std::fs::read_dir(font_dirs) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    let ext_lower = ext.to_string_lossy().to_lowercase();
                    if ext_lower == "ttf" || ext_lower == "otf" || ext_lower == "woff" {
                        if let Some(name) = path.file_stem() {
                            fonts.push(name.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    fonts.sort();
    fonts.dedup();
    Ok(fonts)
}
