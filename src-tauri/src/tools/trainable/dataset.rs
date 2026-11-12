use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BBoxAnnotation {
    pub class_id: usize,
    pub x_center: f32,
    pub y_center: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct DetectionItem {
    pub image_path: String,
    pub image_width: u32,
    pub image_height: u32,
    pub bboxes: Vec<BBoxAnnotation>,
}

#[derive(Debug, Clone)]
pub struct DetectionDataset {
    items: Vec<DetectionItem>,
}

#[allow(dead_code)]
impl DetectionDataset {
    pub fn new() -> Self {
        Self { items: Vec::new() }
    }

    pub fn add_item(&mut self, item: DetectionItem) {
        self.items.push(item);
    }

    pub fn items(&self) -> &[DetectionItem] {
        &self.items
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn from_yolo_dir(
        images_dir: &str,
        labels_dir: &str,
        _class_names: &[(usize, String)],
    ) -> Result<Self, String> {
        let images_path = Path::new(images_dir);
        if !images_path.exists() {
            return Err(format!("Images directory not found: {}", images_dir));
        }

        let mut dataset = Self::new();
        let entries = std::fs::read_dir(images_path).map_err(|e| e.to_string())?;

        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

            if !matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "bmp") {
                continue;
            }

            let stem = path.file_stem().and_then(|e| e.to_str()).unwrap_or("");
            let label_path = Path::new(labels_dir).join(format!("{}.txt", stem));

            let (w, h) = match image::image_dimensions(&path) {
                Ok((w, h)) => (w, h),
                Err(_) => continue,
            };

            let mut bboxes = Vec::new();
            if label_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&label_path) {
                    for line in content.lines() {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 5 {
                            if let (Ok(class_id), Ok(cx), Ok(cy), Ok(bw), Ok(bh)) = (
                                parts[0].parse::<usize>(),
                                parts[1].parse::<f32>(),
                                parts[2].parse::<f32>(),
                                parts[3].parse::<f32>(),
                                parts[4].parse::<f32>(),
                            ) {
                                bboxes.push(BBoxAnnotation {
                                    class_id,
                                    x_center: cx,
                                    y_center: cy,
                                    width: bw,
                                    height: bh,
                                });
                            }
                        }
                    }
                }
            }

            dataset.add_item(DetectionItem {
                image_path: path.to_str().unwrap_or("").to_string(),
                image_width: w,
                image_height: h,
                bboxes,
            });
        }

        Ok(dataset)
    }

    pub fn split(
        &self,
        train_ratio: f32,
        val_ratio: f32,
    ) -> (DetectionDataset, DetectionDataset, DetectionDataset) {
        let total = self.items.len();
        let train_end = (total as f32 * train_ratio) as usize;
        let val_end = train_end + (total as f32 * val_ratio) as usize;

        let mut train = DetectionDataset::new();
        let mut val = DetectionDataset::new();
        let mut test = DetectionDataset::new();

        for (i, item) in self.items.iter().enumerate() {
            if i < train_end {
                train.add_item(item.clone());
            } else if i < val_end {
                val.add_item(item.clone());
            } else {
                test.add_item(item.clone());
            }
        }

        (train, val, test)
    }
}
