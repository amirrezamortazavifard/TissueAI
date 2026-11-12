use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceDirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceImageData {
    /// Raw base64 payload (no `data:` prefix) so callers can compose their own data URL.
    pub base64: String,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
}

/// List a directory's immediate entries, directories first then by name.
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<WorkspaceDirEntry>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = entry
            .file_type()
            .map(|ft| ft.is_dir())
            .unwrap_or(false);
        let size = if is_dir {
            0
        } else {
            entry.metadata().map(|m| m.len()).unwrap_or(0)
        };
        result.push(WorkspaceDirEntry {
            name,
            path: p.to_string_lossy().to_string(),
            is_dir,
            size,
        });
    }
    result.sort_by(|a, b| {
        a.is_dir
            .cmp(&b.is_dir)
            .reverse()
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(result)
}

/// Opens an image file and returns it downscaled to at most `max_dim` on the
/// longest edge. Output is always PNG. Returns raw base64 for chat injection.
#[tauri::command]
pub fn read_image_base64(path: String, max_dim: u32) -> Result<WorkspaceImageData, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let (w, h) = (img.width(), img.height());
    let dim = max_dim.max(1);
    let out = if w.max(h) > dim {
        let ratio = dim as f32 / (w.max(h)) as f32;
        let nw = ((w as f32) * ratio).round().max(1.0) as u32;
        let nh = ((h as f32) * ratio).round().max(1.0) as u32;
        img.resize(nw, nh, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    let mut buf = std::io::Cursor::new(Vec::new());
    out.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
    Ok(WorkspaceImageData {
        base64: b64,
        mime_type: "image/png".to_string(),
        width: w,
        height: h,
    })
}