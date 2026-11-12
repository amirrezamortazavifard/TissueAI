pub mod cache;
pub mod reader;
pub mod scheduler;

pub use cache::{TileCache, TileCacheStats, TileKey};
pub use reader::{
    build_pyramid_levels, open_slide_auto, PyramidLevel, PyramidalSlideReader,
    StandardRasterReader, WsiMetadata, WsiReader,
};
pub use scheduler::{TileRequest, TileScheduler, ViewportState};

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Global WSI Session Registry
#[derive(Default)]
pub struct WsiSessionRegistry {
    readers: Mutex<HashMap<String, Arc<dyn WsiReader>>>,
    cache: Arc<TileCache>,
}

impl WsiSessionRegistry {
    pub fn new() -> Self {
        Self {
            readers: Mutex::new(HashMap::new()),
            cache: Arc::new(TileCache::default()),
        }
    }

    pub fn cache(&self) -> Arc<TileCache> {
        self.cache.clone()
    }

    pub fn register(&self, reader: Arc<dyn WsiReader>) -> String {
        let slide_id = reader.metadata().slide_id.clone();
        if let Ok(mut map) = self.readers.lock() {
            map.insert(slide_id.clone(), reader);
        }
        slide_id
    }

    pub fn get(&self, slide_id: &str) -> Option<Arc<dyn WsiReader>> {
        let map = self.readers.lock().ok()?;
        map.get(slide_id).cloned()
    }

    pub fn remove(&self, slide_id: &str) -> bool {
        self.cache.clear_slide(slide_id);
        if let Ok(mut map) = self.readers.lock() {
            map.remove(slide_id).is_some()
        } else {
            false
        }
    }

    pub fn list_active_slides(&self) -> Vec<WsiMetadata> {
        let map = self.readers.lock().unwrap_or_else(|e| e.into_inner());
        map.values().map(|r| r.metadata().clone()).collect()
    }
}
