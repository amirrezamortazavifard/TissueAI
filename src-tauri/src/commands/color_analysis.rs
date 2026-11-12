use image::{DynamicImage, Rgb, RgbImage};
use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct ColorAnalysisState {
    pub current_image: Mutex<Option<RgbImage>>,
    pub original_image: Mutex<Option<RgbImage>>,
    pub pixel_cluster_assignments: Mutex<Option<Vec<i32>>>,
    pub centroids: Mutex<Option<Vec<Rgb<u8>>>>,
    pub history: Mutex<Vec<ColorHistoryItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorHistoryItem {
    pub description: String,
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DominantColorResult {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub hex: String,
    pub percentage: f64,
    pub cluster_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeconvolutionResult {
    pub channel_name: String,
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContourResult {
    pub points: Vec<(i32, i32)>,
    pub area: f64,
    pub centroid_x: f64,
    pub centroid_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantitativeResult {
    pub pixel_count: u64,
    pub percentage: f64,
}

fn color_distance(c1: Rgb<u8>, c2: Rgb<u8>) -> f64 {
    let dr = c1[0] as f64 - c2[0] as f64;
    let dg = c1[1] as f64 - c2[1] as f64;
    let db = c1[2] as f64 - c2[2] as f64;
    (dr * dr + dg * dg + db * db).sqrt()
}

fn rgb_to_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{:02X}{:02X}{:02X}", r, g, b)
}

fn average_color(pixels: &[Rgb<u8>]) -> Rgb<u8> {
    if pixels.is_empty() {
        return Rgb([0, 0, 0]);
    }
    let mut total_r: u64 = 0;
    let mut total_g: u64 = 0;
    let mut total_b: u64 = 0;
    for p in pixels {
        total_r += p[0] as u64;
        total_g += p[1] as u64;
        total_b += p[2] as u64;
    }
    let n = pixels.len() as u64;
    Rgb([
        (total_r / n) as u8,
        (total_g / n) as u8,
        (total_b / n) as u8,
    ])
}

fn blend(c1: Rgb<u8>, c2: Rgb<u8>, amount: f64) -> Rgb<u8> {
    Rgb([
        ((c1[0] as f64 * (1.0 - amount)) + c2[0] as f64 * amount) as u8,
        ((c1[1] as f64 * (1.0 - amount)) + c2[1] as f64 * amount) as u8,
        ((c1[2] as f64 * (1.0 - amount)) + c2[2] as f64 * amount) as u8,
    ])
}

fn save_state(state: &ColorAnalysisState, description: &str) {
    if let Some(img) = state.current_image.lock().unwrap().as_ref() {
        let item = ColorHistoryItem {
            description: description.to_string(),
            width: img.width(),
            height: img.height(),
            pixels: img.clone().into_raw(),
        };
        state.history.lock().unwrap().push(item);
    }
}

#[tauri::command]
pub async fn load_color_image(path: String, state: State<'_, ColorAnalysisState>) -> Result<(u32, u32), String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let mut rgb = img.to_rgb8();

    let max_dim = 800;
    if rgb.width() > max_dim || rgb.height() > max_dim {
        rgb = image::imageops::resize(&rgb, max_dim, max_dim, FilterType::Triangle);
    }

    let (w, h) = (rgb.width(), rgb.height());
    *state.original_image.lock().unwrap() = Some(rgb.clone());
    *state.current_image.lock().unwrap() = Some(rgb);
    *state.pixel_cluster_assignments.lock().unwrap() = None;
    *state.centroids.lock().unwrap() = None;
    state.history.lock().unwrap().clear();

    save_state(&state, "Original Image");
    Ok((w, h))
}

#[tauri::command]
pub async fn analyze_dominant_colors(
    k: usize,
    state: State<'_, ColorAnalysisState>,
) -> Result<Vec<DominantColorResult>, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width() as usize;
    let height = img.height() as usize;
    let raw = img.into_raw();
    let total_pixels = width * height;

    let mut pixels: Vec<Rgb<u8>> = Vec::with_capacity(total_pixels);
    for i in 0..total_pixels {
        let idx = i * 3;
        pixels.push(Rgb([raw[idx], raw[idx + 1], raw[idx + 2]]));
    }

    let mut rng_state: u64 = 42;
    let mut centroids: Vec<Rgb<u8>> = (0..k).map(|_| {
        rng_state = rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let idx = (rng_state as usize) % total_pixels;
        pixels[idx]
    }).collect();

    let mut assignments = vec![0i32; total_pixels];

    for _ in 0..15 {
        let mut clusters: Vec<Vec<Rgb<u8>>> = vec![Vec::new(); k];
        for (p_idx, pixel) in pixels.iter().enumerate() {
            let mut min_dist = f64::MAX;
            let mut nearest = 0;
            for (c_idx, centroid) in centroids.iter().enumerate() {
                let d = color_distance(*pixel, *centroid);
                if d < min_dist {
                    min_dist = d;
                    nearest = c_idx;
                }
            }
            assignments[p_idx] = nearest as i32;
            clusters[nearest].push(*pixel);
        }
        for c_idx in 0..k {
            if !clusters[c_idx].is_empty() {
                centroids[c_idx] = average_color(&clusters[c_idx]);
            }
        }
    }

    let mut results: Vec<DominantColorResult> = Vec::new();
    for c_idx in 0..k {
        let count = assignments.iter().filter(|&&a| a == c_idx as i32).count();
        if count > 0 {
            let c = centroids[c_idx];
            results.push(DominantColorResult {
                r: c[0],
                g: c[1],
                b: c[2],
                hex: rgb_to_hex(c[0], c[1], c[2]),
                percentage: count as f64 * 100.0 / total_pixels as f64,
                cluster_index: c_idx,
            });
        }
    }
    results.sort_by(|a, b| b.percentage.partial_cmp(&a.percentage).unwrap());

    *state.pixel_cluster_assignments.lock().unwrap() = Some(assignments);
    *state.centroids.lock().unwrap() = Some(centroids);

    save_state(&state, "Dominant Color Analysis");
    Ok(results)
}

#[tauri::command]
pub async fn analyze_region(
    center_x: f64,
    center_y: f64,
    radius_x: f64,
    radius_y: f64,
    k: usize,
    state: State<'_, ColorAnalysisState>,
) -> Result<Vec<DominantColorResult>, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width() as usize;
    let height = img.height() as usize;
    let raw = img.into_raw();

    let mut roi_pixels: Vec<Rgb<u8>> = Vec::new();
    let mut roi_indices: Vec<usize> = Vec::new();
    for y in 0..height {
        for x in 0..width {
            let dx = (x as f64 - center_x) / radius_x;
            let dy = (y as f64 - center_y) / radius_y;
            if dx * dx + dy * dy <= 1.0 {
                let idx = (y * width + x) * 3;
                roi_pixels.push(Rgb([raw[idx], raw[idx + 1], raw[idx + 2]]));
                roi_indices.push(y * width + x);
            }
        }
    }

    if roi_pixels.is_empty() {
        return Ok(Vec::new());
    }

    let total_pixels = width * height;
    let mut rng_state: u64 = 42;
    let mut centroids: Vec<Rgb<u8>> = (0..k).map(|_| {
        rng_state = rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let idx = (rng_state as usize) % roi_pixels.len();
        roi_pixels[idx]
    }).collect();

    for _ in 0..15 {
        let mut clusters: Vec<Vec<Rgb<u8>>> = vec![Vec::new(); k];
        for pixel in &roi_pixels {
            let mut min_dist = f64::MAX;
            let mut nearest = 0;
            for (c_idx, centroid) in centroids.iter().enumerate() {
                let d = color_distance(*pixel, *centroid);
                if d < min_dist {
                    min_dist = d;
                    nearest = c_idx;
                }
            }
            clusters[nearest].push(*pixel);
        }
        for c_idx in 0..k {
            if !clusters[c_idx].is_empty() {
                centroids[c_idx] = average_color(&clusters[c_idx]);
            }
        }
    }

    let mut assignments = vec![-1i32; total_pixels];
    for &idx in &roi_indices {
        let pixel = Rgb([raw[idx * 3], raw[idx * 3 + 1], raw[idx * 3 + 2]]);
        let mut min_dist = f64::MAX;
        let mut nearest = 0;
        for (c_idx, centroid) in centroids.iter().enumerate() {
            let d = color_distance(pixel, *centroid);
            if d < min_dist {
                min_dist = d;
                nearest = c_idx;
            }
        }
        assignments[idx] = nearest as i32;
    }

    let mut results: Vec<DominantColorResult> = Vec::new();
    for c_idx in 0..k {
        let count = roi_indices.iter().filter(|&&idx| assignments[idx] == c_idx as i32).count();
        if count > 0 {
            let c = centroids[c_idx];
            results.push(DominantColorResult {
                r: c[0],
                g: c[1],
                b: c[2],
                hex: rgb_to_hex(c[0], c[1], c[2]),
                percentage: count as f64 * 100.0 / roi_pixels.len() as f64,
                cluster_index: c_idx,
            });
        }
    }
    results.sort_by(|a, b| b.percentage.partial_cmp(&a.percentage).unwrap());

    *state.pixel_cluster_assignments.lock().unwrap() = Some(assignments);
    *state.centroids.lock().unwrap() = Some(centroids);

    save_state(&state, "ROI Analysis");
    Ok(results)
}

#[tauri::command]
pub async fn analyze_with_seed_color(
    seed_r: u8,
    seed_g: u8,
    seed_b: u8,
    state: State<'_, ColorAnalysisState>,
) -> Result<Vec<DominantColorResult>, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width() as usize;
    let height = img.height() as usize;
    let raw = img.into_raw();
    let total_pixels = width * height;
    let seed = Rgb([seed_r, seed_g, seed_b]);
    let threshold = 20.0;

    let mut assignments = vec![-1i32; total_pixels];
    let mut match_count = 0u64;

    for i in 0..total_pixels {
        let idx = i * 3;
        let pixel = Rgb([raw[idx], raw[idx + 1], raw[idx + 2]]);
        if color_distance(pixel, seed) <= threshold {
            assignments[i] = 0;
            match_count += 1;
        }
    }

    let mut results = Vec::new();
    if match_count > 0 {
        results.push(DominantColorResult {
            r: seed_r,
            g: seed_g,
            b: seed_b,
            hex: rgb_to_hex(seed_r, seed_g, seed_b),
            percentage: match_count as f64 * 100.0 / total_pixels as f64,
            cluster_index: 0,
        });
    }

    *state.pixel_cluster_assignments.lock().unwrap() = Some(assignments);
    *state.centroids.lock().unwrap() = Some(vec![seed]);

    save_state(&state, "Eyedropper Analysis");
    Ok(results)
}

#[tauri::command]
pub async fn replace_color(
    cluster_index: i32,
    new_r: u8,
    new_g: u8,
    new_b: u8,
    state: State<'_, ColorAnalysisState>,
) -> Result<(), String> {
    let mut img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let assignments = state.pixel_cluster_assignments.lock().unwrap().clone().ok_or("No analysis done")?;
    let width = img.width() as usize;

    for (i, &cluster) in assignments.iter().enumerate() {
        if cluster == cluster_index {
            let x = (i % width) as u32;
            let y = (i / width) as u32;
            img.put_pixel(x, y, Rgb([new_r, new_g, new_b]));
        }
    }

    *state.current_image.lock().unwrap() = Some(img);
    save_state(&state, &format!("Replaced color cluster {}", cluster_index));
    Ok(())
}

#[tauri::command]
pub async fn remove_color(cluster_index: i32, state: State<'_, ColorAnalysisState>) -> Result<(), String> {
    replace_color(cluster_index, 128, 128, 128, state).await
}

#[tauri::command]
pub async fn apply_isolation(
    cluster_indices: Vec<i32>,
    isolation_value: f64,
    state: State<'_, ColorAnalysisState>,
) -> Result<(), String> {
    let mut img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let assignments = state.pixel_cluster_assignments.lock().unwrap().clone().ok_or("No analysis done")?;
    let width = img.width() as usize;
    let amount = isolation_value.abs() / 100.0;
    let bg = Rgb([255u8, 255u8, 255u8]);

    for (i, &cluster) in assignments.iter().enumerate() {
        let is_selected = cluster_indices.contains(&cluster);
        let should_modify = (isolation_value > 0.0 && !is_selected) || (isolation_value < 0.0 && is_selected);
        if should_modify {
            let x = (i % width) as u32;
            let y = (i / width) as u32;
            let pixel = *img.get_pixel(x, y);
            let blended = blend(pixel, bg, amount);
            img.put_pixel(x, y, blended);
        }
    }

    *state.current_image.lock().unwrap() = Some(img);
    save_state(&state, &format!("Isolation: {}", isolation_value));
    Ok(())
}

#[tauri::command]
pub async fn undo_action(state: State<'_, ColorAnalysisState>) -> Result<(), String> {
    let mut history = state.history.lock().unwrap();
    if history.len() > 1 {
        history.pop();
        let last = history.last().unwrap().clone();
        let img = RgbImage::from_raw(last.width, last.height, last.pixels)
            .ok_or("Failed to reconstruct image")?;
        *state.current_image.lock().unwrap() = Some(img);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_color_at_pixel(
    x: u32,
    y: u32,
    state: State<'_, ColorAnalysisState>,
) -> Result<(u8, u8, u8), String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let pixel = img.get_pixel(x, y);
    Ok((pixel[0], pixel[1], pixel[2]))
}

#[tauri::command]
pub async fn find_cluster_for_pixel(
    x: u32,
    y: u32,
    state: State<'_, ColorAnalysisState>,
) -> Result<i32, String> {
    let assignments = state.pixel_cluster_assignments.lock().unwrap().clone().ok_or("No analysis done")?;
    let width = state.current_image.lock().unwrap().as_ref().map(|i| i.width()).unwrap_or(0) as usize;
    let idx = (y as usize) * width + (x as usize);
    if idx < assignments.len() {
        Ok(assignments[idx])
    } else {
        Ok(-1)
    }
}

#[tauri::command]
pub async fn deconvolve_stains(
    stain_type: String,
    state: State<'_, ColorAnalysisState>,
) -> Result<Vec<DeconvolutionResult>, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width() as usize;
    let height = img.height() as usize;
    let raw = img.into_raw();

    let (matrix, channel_names): (Vec<Vec<f64>>, Vec<&str>) = match stain_type.as_str() {
        "H&E" => (vec![vec![0.65, 0.70, 0.29], vec![0.07, 0.99, 0.11]], vec!["Hematoxylin", "Eosin"]),
        "H-DAB" => (vec![vec![0.65, 0.70, 0.29], vec![0.27, 0.57, 0.78]], vec!["Hematoxylin", "DAB"]),
        "Masson's Trichrome" => (vec![vec![0.799, 0.591, 0.105], vec![0.092, 0.851, 0.499], vec![0.435, 0.198, 0.882]], vec!["Hematoxylin", "Fuchsin", "Aniline Blue"]),
        "PAS" => (vec![vec![0.65, 0.70, 0.29], vec![0.80, 0.16, 0.59]], vec!["Hematoxylin", "PAS"]),
        "Giemsa" => (vec![vec![0.65, 0.70, 0.29], vec![0.07, 0.99, 0.11]], vec!["Methylene Blue", "Eosin"]),
        "Alcian Blue" => (vec![vec![0.88, 0.45, 0.15], vec![0.10, 0.77, 0.63]], vec!["Nuclear Fast Red", "Alcian Blue"]),
        "Feulgen-Light Green" => (vec![vec![0.99, 0.12, 0.06], vec![0.10, 0.99, 0.03]], vec!["Feulgen", "Light Green"]),
        "Methyl Green-DAB" => (vec![vec![0.98, 0.15, 0.12], vec![0.27, 0.57, 0.78]], vec!["Methyl Green", "DAB"]),
        _ => return Err("Unsupported stain type".to_string()),
    };

    let stain_count = channel_names.len();
    let mut channels: Vec<Vec<u8>> = vec![vec![0u8; width * height * 3]; stain_count];

    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * 3;
            let r = raw[idx] as f64;
            let g = raw[idx + 1] as f64;
            let b = raw[idx + 2] as f64;

            let r_od = -((r + 1.0) / 256.0).log10();
            let g_od = -((g + 1.0) / 256.0).log10();
            let _b_od = -((b + 1.0) / 256.0).log10();

            if stain_count == 2 {
                let det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
                if det.abs() < 1e-6 {
                    continue;
                }

                let s1 = (matrix[1][1] * r_od - matrix[0][1] * g_od) / det;
                let s2 = (-matrix[1][0] * r_od + matrix[0][0] * g_od) / det;

                for (ch, &s) in [s1, s2].iter().enumerate() {
                    let cr = (255.0 * 10f64.powf(-s * matrix[ch][0])).clamp(0.0, 255.0) as u8;
                    let cg = (255.0 * 10f64.powf(-s * matrix[ch][1])).clamp(0.0, 255.0) as u8;
                    let cb = (255.0 * 10f64.powf(-s * matrix[ch][2])).clamp(0.0, 255.0) as u8;
                    let cidx = (y * width + x) * 3;
                    channels[ch][cidx] = cr;
                    channels[ch][cidx + 1] = cg;
                    channels[ch][cidx + 2] = cb;
                }
            }
        }
    }

    save_state(&state, &format!("Deconvolution: {}", stain_type));

    Ok(channel_names.iter().enumerate().map(|(i, &name)| {
        DeconvolutionResult {
            channel_name: name.to_string(),
            width: width as u32,
            height: height as u32,
            pixels: channels[i].clone(),
        }
    }).collect())
}

#[tauri::command]
pub async fn find_objects_for_color(
    cluster_index: i32,
    threshold: f64,
    min_area: f64,
    state: State<'_, ColorAnalysisState>,
) -> Result<Vec<ContourResult>, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let _assignments = state.pixel_cluster_assignments.lock().unwrap().clone().ok_or("No analysis done")?;
    let centroids = state.centroids.lock().unwrap().clone().ok_or("No centroids")?;
    let width = img.width() as usize;
    let height = img.height() as usize;

    if cluster_index < 0 || cluster_index >= centroids.len() as i32 {
        return Ok(Vec::new());
    }

    let target = centroids[cluster_index as usize];
    let raw = img.into_raw();

    let mut mask = vec![false; width * height];
    for i in 0..(width * height) {
        let idx = i * 3;
        let pixel = Rgb([raw[idx], raw[idx + 1], raw[idx + 2]]);
        if color_distance(pixel, target) <= threshold {
            mask[i] = true;
        }
    }

    let mut visited = vec![false; width * height];
    let mut contours = Vec::new();

    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            if mask[idx] && !visited[idx] {
                let mut stack = vec![(x as i32, y as i32)];
                let mut component = Vec::new();
                visited[idx] = true;

                while let Some((cx, cy)) = stack.pop() {
                    component.push((cx, cy));
                    for &(dx, dy) in &[(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)] {
                        let nx = cx + dx;
                        let ny = cy + dy;
                        if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                            let nidx = ny as usize * width + nx as usize;
                            if mask[nidx] && !visited[nidx] {
                                visited[nidx] = true;
                                stack.push((nx, ny));
                            }
                        }
                    }
                }

                let area = component.len() as f64;
                if area >= min_area {
                    let sum_x: f64 = component.iter().map(|&(x, _)| x as f64).sum();
                    let sum_y: f64 = component.iter().map(|&(_, y)| y as f64).sum();
                    contours.push(ContourResult {
                        points: component,
                        area,
                        centroid_x: sum_x / area,
                        centroid_y: sum_y / area,
                    });
                }
            }
        }
    }

    Ok(contours)
}

#[tauri::command]
pub async fn generate_heatmap(
    contour_centroids: Vec<(f64, f64)>,
    radius: i32,
    opacity: f64,
    state: State<'_, ColorAnalysisState>,
) -> Result<(u32, u32, Vec<u8>), String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width() as usize;
    let height = img.height() as usize;

    let mut density_map = vec![0.0f64; width * height];

    for &(cx, cy) in &contour_centroids {
        let r = radius as f64;
        let min_x = ((cx - r).max(0.0) as usize).min(width - 1);
        let max_x = (cx + r).min(width as f64 - 1.0) as usize;
        let min_y = ((cy - r).max(0.0) as usize).min(height - 1);
        let max_y = (cy + r).min(height as f64 - 1.0) as usize;

        for y in min_y..=max_y {
            for x in min_x..=max_x {
                let dx = x as f64 - cx;
                let dy = y as f64 - cy;
                let dist = (dx * dx + dy * dy).sqrt();
                if dist <= r {
                    let intensity = 1.0 - dist / r;
                    density_map[y * width + x] += intensity;
                }
            }
        }
    }

    let mut max_val = 0.0f64;
    for &v in &density_map {
        if v > max_val {
            max_val = v;
        }
    }
    if max_val > 0.0 {
        for v in &mut density_map {
            *v = *v / max_val * 255.0;
        }
    }

    let kernel_size = (radius * 2 + 1) as usize;
    let blurred = gaussian_blur(&density_map, width, height, kernel_size);

    let mut output = vec![0u8; width * height * 4];
    for i in 0..(width * height) {
        let intensity = blurred[i];
        if intensity > 15.0 {
            let (r, g, b) = color_for_intensity(intensity / 255.0);
            let idx = i * 4;
            output[idx] = (r * 255.0) as u8;
            output[idx + 1] = (g * 255.0) as u8;
            output[idx + 2] = (b * 255.0) as u8;
            output[idx + 3] = (opacity * intensity) as u8;
        }
    }

    Ok((width as u32, height as u32, output))
}

fn gaussian_blur(data: &[f64], width: usize, height: usize, kernel_size: usize) -> Vec<f64> {
    let mut result = vec![0.0; width * height];
    let half = kernel_size / 2;
    let sigma = kernel_size as f64 / 6.0;
    let mut kernel = vec![0.0; kernel_size];
    let mut sum = 0.0;
    for i in 0..kernel_size {
        let x = i as f64 - half as f64;
        kernel[i] = (-x * x / (2.0 * sigma * sigma)).exp();
        sum += kernel[i];
    }
    for k in &mut kernel {
        *k /= sum;
    }

    let mut temp = vec![0.0; width * height];
    for y in 0..height {
        for x in 0..width {
            let mut val = 0.0;
            for k in 0..kernel_size {
                let sx = (x as i32 + k as i32 - half as i32).max(0).min(width as i32 - 1) as usize;
                val += data[y * width + sx] * kernel[k];
            }
            temp[y * width + x] = val;
        }
    }

    for y in 0..height {
        for x in 0..width {
            let mut val = 0.0;
            for k in 0..kernel_size {
                let sy = (y as i32 + k as i32 - half as i32).max(0).min(height as i32 - 1) as usize;
                val += temp[sy * width + x] * kernel[k];
            }
            result[y * width + x] = val;
        }
    }

    result
}

fn color_for_intensity(intensity: f64) -> (f64, f64, f64) {
    if intensity < 0.25 {
        (0.0, 4.0 * intensity, 1.0)
    } else if intensity < 0.5 {
        (0.0, 1.0, 1.0 - 4.0 * (intensity - 0.25))
    } else if intensity < 0.75 {
        (4.0 * (intensity - 0.5), 1.0, 0.0)
    } else {
        (1.0, 1.0 - 4.0 * (intensity - 0.75), 0.0)
    }
}

#[tauri::command]
pub async fn inpaint_artifact(
    cluster_index: i32,
    state: State<'_, ColorAnalysisState>,
) -> Result<(), String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let _assignments = state.pixel_cluster_assignments.lock().unwrap().clone().ok_or("No analysis done")?;
    let width = img.width() as usize;
    let height = img.height() as usize;

    let mut mask = vec![0u8; width * height];
    for (i, &cluster) in _assignments.iter().enumerate() {
        if cluster == cluster_index {
            mask[i] = 255;
        }
    }

    let inpainted = simple_inpaint(&img, &mask, width, height, 5);
    *state.current_image.lock().unwrap() = Some(inpainted);
    save_state(&state, "Artifact removed");
    Ok(())
}

#[tauri::command]
pub async fn inpaint_single_contour(
    contour_points: Vec<(i32, i32)>,
    state: State<'_, ColorAnalysisState>,
) -> Result<(), String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let width = img.width() as usize;

    let height = img.height() as usize;

    let mut mask = vec![0u8; width * height];
    for &(x, y) in &contour_points {
        if x >= 0 && x < width as i32 && y >= 0 && y < height as i32 {
            mask[y as usize * width + x as usize] = 255;
        }
    }

    let inpainted = simple_inpaint(&img, &mask, width, height, 5);
    *state.current_image.lock().unwrap() = Some(inpainted);
    save_state(&state, "Single artifact removed");
    Ok(())
}

fn simple_inpaint(img: &RgbImage, mask: &[u8], width: usize, height: usize, radius: i32) -> RgbImage {
    let raw = img.clone().into_raw();
    let mut result = raw.clone();

    for y in 0..height {
        for x in 0..width {
            if mask[y * width + x] == 255 {
                let mut sum_r = 0u64;
                let mut sum_g = 0u64;
                let mut sum_b = 0u64;
                let mut count = 0u64;

                for dy in -radius..=radius {
                    for dx in -radius..=radius {
                        let nx = x as i32 + dx;
                        let ny = y as i32 + dy;
                        if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                            let nidx = (ny as usize * width + nx as usize) * 3;
                            if mask[ny as usize * width + nx as usize] == 0 {
                                sum_r += raw[nidx] as u64;
                                sum_g += raw[nidx + 1] as u64;
                                sum_b += raw[nidx + 2] as u64;
                                count += 1;
                            }
                        }
                    }
                }

                if count > 0 {
                    let idx = (y * width + x) * 3;
                    result[idx] = (sum_r / count) as u8;
                    result[idx + 1] = (sum_g / count) as u8;
                    result[idx + 2] = (sum_b / count) as u8;
                }
            }
        }
    }

    RgbImage::from_raw(width as u32, height as u32, result).unwrap_or_else(|| img.clone())
}

#[tauri::command]
pub async fn get_image_as_base64(state: State<'_, ColorAnalysisState>) -> Result<String, String> {
    let img = state.current_image.lock().unwrap().clone().ok_or("No image loaded")?;
    let dynamic = DynamicImage::ImageRgb8(img);
    let mut buf = std::io::Cursor::new(Vec::new());
    dynamic.write_to(&mut buf, image::ImageFormat::Png).map_err(|e| e.to_string())?;
    use base64::Engine;
    Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(buf.into_inner())))
}

#[tauri::command]
pub async fn get_quantitative_results(
    cluster_index: i32,
    state: State<'_, ColorAnalysisState>,
) -> Result<QuantitativeResult, String> {
    let assignments = state.pixel_cluster_assignments.lock().unwrap().clone().ok_or("No analysis done")?;
    let total = assignments.len() as f64;
    let count = assignments.iter().filter(|&&a| a == cluster_index).count() as u64;

    Ok(QuantitativeResult {
        pixel_count: count,
        percentage: count as f64 * 100.0 / total,
    })
}

#[tauri::command]
pub async fn export_color_csv(
    results: Vec<DominantColorResult>,
) -> Result<String, String> {
    let mut csv = String::from("Hex,Percentage,ClusterIndex\n");
    for r in &results {
        csv.push_str(&format!("{},{:.2},{}\n", r.hex, r.percentage, r.cluster_index));
    }
    Ok(csv)
}
