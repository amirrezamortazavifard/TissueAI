use arboard::Clipboard;
use base64::Engine;

/// Read an image from the OS clipboard and return it as a base64 data URL.
/// Returns `None` if the clipboard doesn't contain an image.
#[tauri::command]
pub fn read_clipboard_image() -> Option<String> {
    let mut clipboard = Clipboard::new().ok()?;
    let image = clipboard.get_image().ok()?;

    // Convert to PNG bytes
    let png_bytes = image_to_png_bytes(&image)?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Some(format!("data:image/png;base64,{}", b64))
}

/// Read text from the OS clipboard.
#[tauri::command]
pub fn read_clipboard_text() -> Option<String> {
    let mut clipboard = Clipboard::new().ok()?;
    clipboard.get_text().ok().map(|s| s.to_string())
}

/// Get the current OS username.
#[tauri::command]
pub fn get_os_username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "User".to_string())
}

fn image_to_png_bytes(img: &arboard::ImageData) -> Option<Vec<u8>> {
    let width = img.width as u32;
    let height = img.height as u32;
    let bytes = img.bytes.as_ref();

    // arboard gives us BGRA pixels on Windows. Convert to RGBA for the image crate.
    let mut rgba = Vec::with_capacity(bytes.len());
    for chunk in bytes.chunks(4) {
        if chunk.len() < 4 {
            break;
        }
        rgba.push(chunk[2]); // R
        rgba.push(chunk[1]); // G
        rgba.push(chunk[0]); // B
        rgba.push(chunk[3]); // A
    }

    let img = image::RgbaImage::from_raw(width, height, rgba)?;
    let mut buf = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(img)
        .write_to(&mut buf, image::ImageFormat::Png)
        .ok()?;
    Some(buf.into_inner())
}
