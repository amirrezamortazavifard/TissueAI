use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub confidence: f32,
    pub class_id: i32,
    pub class_name: String,
}

impl BoundingBox {
    pub fn left(&self) -> f32 {
        self.x - self.width / 2.0
    }

    pub fn top(&self) -> f32 {
        self.y - self.height / 2.0
    }

    pub fn right(&self) -> f32 {
        self.x + self.width / 2.0
    }

    pub fn bottom(&self) -> f32 {
        self.y + self.height / 2.0
    }

    pub fn area(&self) -> f32 {
        self.width * self.height
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageDetectionResult {
    pub file_path: String,
    pub detections: Vec<BoundingBox>,
    pub processing_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionInfo {
    pub index: usize,
    pub label: String,
    pub confidence: f32,
    pub original_box: BoundingBox,
}
