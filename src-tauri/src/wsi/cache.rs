use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Instant;

#[derive(Hash, PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
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

/// Statistics and health profile of the WSI tile cache (M2-06)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileCacheStats {
    pub current_bytes: usize,
    pub max_bytes: usize,
    pub entry_count: usize,
    pub hit_count: u64,
    pub miss_count: u64,
}

/// Thread-safe bounded LRU tile cache with byte budget tracking (options.md WSI-04, M2-06)
pub struct TileCache {
    entries: Mutex<HashMap<TileKey, CacheEntry>>,
    max_bytes: usize,
    current_bytes: Mutex<usize>,
    hit_count: AtomicU64,
    miss_count: AtomicU64,
}

impl TileCache {
    pub fn new(max_megabytes: usize) -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            max_bytes: max_megabytes * 1024 * 1024,
            current_bytes: Mutex::new(0),
            hit_count: AtomicU64::new(0),
            miss_count: AtomicU64::new(0),
        }
    }

    pub fn get(&self, key: &TileKey) -> Option<Vec<u8>> {
        let mut entries = self.entries.lock().ok()?;
        if let Some(entry) = entries.get_mut(key) {
            entry.last_accessed = Instant::now();
            self.hit_count.fetch_add(1, Ordering::Relaxed);
            Some(entry.data.clone())
        } else {
            self.miss_count.fetch_add(1, Ordering::Relaxed);
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

    pub fn get_stats(&self) -> TileCacheStats {
        let entry_count = self.entries.lock().map(|e| e.len()).unwrap_or(0);
        let current_bytes = self.current_bytes.lock().map(|c| *c).unwrap_or(0);

        TileCacheStats {
            current_bytes,
            max_bytes: self.max_bytes,
            entry_count,
            hit_count: self.hit_count.load(Ordering::Relaxed),
            miss_count: self.miss_count.load(Ordering::Relaxed),
        }
    }
}

impl Default for TileCache {
    fn default() -> Self {
        // Default 256 MB in-memory tile cache
        Self::new(256)
    }
}
