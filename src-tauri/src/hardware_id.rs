use std::sync::OnceLock;

static CACHED_ID: OnceLock<String> = OnceLock::new();

pub fn get_hardware_id() -> String {
    if let Some(id) = CACHED_ID.get() {
        return id.clone();
    }

    let id = get_hardware_id_inner();
    let _ = CACHED_ID.set(id.clone());
    id
}

/// Fallback HWID used when baseboard serial cannot be read or times out.
fn fallback_id() -> String {
    format!("ERR_{}", hostname::get().map(|h| h.to_string_lossy().to_string()).unwrap_or_else(|_| "unknown".to_string()))
}

/// Get a cleaned baseboard serial by running `command` with `args`, enforcing a
/// hard timeout. On Windows, `wmic` is deprecated/removed on recent builds and
/// can hang indefinitely; a bound is required so this never blocks the Tauri
/// main thread (which also freezes the license gate in the UI).
fn run_with_timeout(command: &str, args: &[&str], timeout_ms: u64) -> Option<String> {
    use std::process::Command;
    use std::sync::mpsc;

    let command = command.to_owned();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();

    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let out = Command::new(&command).args(&args).output();
        let _ = tx.send(out.ok());
    });

    let output = match rx.recv_timeout(std::time::Duration::from_millis(timeout_ms)) {
        Ok(Some(o)) => o,
        _ => return None,
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty()
            && trimmed.to_uppercase() != "SERIALNUMBER"
            && !trimmed.contains("To be filled")
            && !trimmed.contains("Default string")
        {
            return Some(trimmed.to_string());
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn get_hardware_id_inner() -> String {
    // wmic is deprecated; if present and responsive, use it. Otherwise fall back
    // to PowerShell `Get-CimInstance`, then to a stable fallback id.
    if let Some(serial) = run_with_timeout("wmic", &["baseboard", "get", "serialnumber"], 1500) {
        return serial;
    }
    if let Some(serial) = run_with_timeout(
        "powershell",
        &[
            "-NoProfile", "-Command",
            "(Get-CimInstance Win32_BaseBoard).SerialNumber",
        ],
        2000,
    ) {
        return serial;
    }
    fallback_id()
}

#[cfg(not(target_os = "windows"))]
fn get_hardware_id_inner() -> String {
    if let Some(serial) = run_with_timeout("cat", &["/sys/class/dmi/id/board_serial"], 1500) {
        return serial;
    }
    fallback_id()
}
