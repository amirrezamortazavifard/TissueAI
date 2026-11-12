use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Hash, PartialEq, Eq, Clone, Debug)]
pub struct TileKey {
    pub slide_id: String,
    pub level: u32,
    pub tile_x: u32,
    pub tile_y: u32,
}

#[derive(Clone)]
struct CacheEntry {
    data: Vec<u8>,
    last_accessed: Instant,
    size_bytes: usize,
}

/// Thread-safe bounded LRU tile cache (options.md WSI-04)
pub struct TileCache {
    entries: Mutex<HashMap<TileKey, CacheEntry>>,
    max_bytes: usize,
    current_bytes: Mutex<usize>,
}

impl TileCache {
    pub fn new(max_megabytes: usize) -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            max_bytes: max_megabytes * 1024 * 1024,
            current_bytes: Mutex::new(0),
        }
    }

    pub fn get(&self, key: &TileKey) -> Option<Vec<u8>> {
        let mut entries = self.entries.lock().ok()?;
        if let Some(entry) = entries.get_mut(key) {
            entry.last_accessed = Instant::now();
            Some(entry.data.clone())
        } else {
            None
        }
    }

    pub fn insert(&self, key: TileKey, data: Vec<u8>) {
        let size = data.len();
        let mut current = if let Ok(c) = self.current_bytes.lock() {
            c
        } else {
            return;
        };

        let mut entries = if let Ok(e) = self.entries.lock() {
            e
        } else {
            return;
        };

        // Evict if cache exceeds bounds
        while *current + size > self.max_bytes && !entries.is_empty() {
            // Find least recently used entry
            let oldest_key = entries
                .iter()
                .min_by_key(|(_, v)| v.last_accessed)
                .map(|(k, _)| k.clone());

            if let Some(k) = oldest_key {
                if let Some(removed) = entries.remove(&k) {
                    *current = current.saturating_sub(removed.size_bytes);
                }
            } else {
                break;
            }
        }

        if let Some(old) = entries.insert(
            key,
            CacheEntry {
                data,
                last_accessed: Instant::now(),
                size_bytes: size,
            },
        ) {
            *current = current.saturating_sub(old.size_bytes);
        }
        *current += size;
    }

    pub fn clear_slide(&self, slide_id: &str) {
        if let (Ok(mut entries), Ok(mut current)) =
            (self.entries.lock(), self.current_bytes.lock())
        {
            let keys_to_remove: Vec<TileKey> = entries
                .keys()
                .filter(|k| k.slide_id == slide_id)
                .cloned()
                .collect();

            for k in keys_to_remove {
                if let Some(removed) = entries.remove(&k) {
                    *current = current.saturating_sub(removed.size_bytes);
                }
            }
        }
    }
}

impl Default for TileCache {
    fn default() -> Self {
        // Default 256 MB in-memory tile cache
        Self::new(256)
    }
}

