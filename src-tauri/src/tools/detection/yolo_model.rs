use std::time::Instant;

use image::{DynamicImage, Rgb, RgbImage};
use ndarray::{Array, Array4, ArrayD};

use super::bounding_box::{BoundingBox, ImageDetectionResult};

pub struct YoloModel {
    session: ort::session::Session,
    pub class_names: Vec<String>,
    pub is_initialized: bool,
}

unsafe impl Send for YoloModel {}
unsafe impl Sync for YoloModel {}

impl YoloModel {
    pub fn new(model_data: &[u8]) -> Result<Self, Box<dyn std::error::Error>> {
        let session = ort::session::Session::builder()?
            .commit_from_memory(model_data)?;

        let mut model = YoloModel {
            session,
            class_names: Vec::new(),
            is_initialized: false,
        };

        model.load_class_names_from_metadata()?;
        model.is_initialized = true;
        Ok(model)
    }

    pub fn from_file(model_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let model_data = crate::crypto::try_decrypt_or_raw(model_path)?;
        Self::new(&model_data)
    }

    fn load_class_names_from_metadata(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let metadata = self.session.metadata()?;
        let names_str = metadata.custom("names")
            .ok_or("No 'names' key in model metadata")?;

        self.class_names = parse_class_names(&names_str);
        if self.class_names.is_empty() {
            return Err("Failed to parse class names from metadata".into());
        }

        Ok(())
    }

    pub fn detect_objects(
        &mut self,
        image_path: &str,
        confidence_threshold: f32,
        nms_threshold: f32,
    ) -> Result<ImageDetectionResult, Box<dyn std::error::Error>> {
        let start = Instant::now();

        let img = image::open(image_path)?;
        let input_array = self.preprocess_image(&img)?;

        let input_name = self.session.inputs()[0].name().to_string();
        let input_value = ort::value::Value::from_array(input_array)?;
        let outputs = self.session.run(ort::inputs![input_name.as_str() => input_value])?;

        let (shape, data) = outputs[0].try_extract_tensor::<f32>()?;
        let dims: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
        let output_array = ArrayD::from_shape_vec(dims, data.to_vec())?;
        drop(outputs);

        let detected_boxes = self.postprocess_output(&output_array, confidence_threshold);
        let nms_boxes = self.apply_nms(detected_boxes, nms_threshold);

        let processing_time = start.elapsed().as_secs_f64() * 1000.0;

        Ok(ImageDetectionResult {
            file_path: image_path.to_string(),
            detections: nms_boxes,
            processing_time_ms: processing_time,
        })
    }

    fn preprocess_image(&self, img: &DynamicImage) -> Result<Array4<f32>, Box<dyn std::error::Error>> {
        let target_size = 640u32;

        let img_width = img.width() as f32;
        let img_height = img.height() as f32;

        let scale = target_size as f32 / img_width.max(img_height);
        let new_w = (img_width * scale) as u32;
        let new_h = (img_height * scale) as u32;

        let resized = img.resize_exact(
            new_w,
            new_h,
            image::imageops::FilterType::CatmullRom,
        );

        let mut padded = RgbImage::from_pixel(target_size, target_size, Rgb([114, 114, 114]));

        let paste_x = (target_size - new_w) / 2;
        let paste_y = (target_size - new_h) / 2;

        let resized_rgb = resized.to_rgb8();
        for y in 0..new_h {
            for x in 0..new_w {
                let pixel = resized_rgb.get_pixel(x, y);
                padded.put_pixel(paste_x + x, paste_y + y, *pixel);
            }
        }

        let mut tensor = Array::zeros((1, 3, target_size as usize, target_size as usize));

        for y in 0..target_size as usize {
            for x in 0..target_size as usize {
                let pixel = padded.get_pixel(x as u32, y as u32);
                tensor[[0, 0, y, x]] = pixel[0] as f32 / 255.0;
                tensor[[0, 1, y, x]] = pixel[1] as f32 / 255.0;
                tensor[[0, 2, y, x]] = pixel[2] as f32 / 255.0;
            }
        }

        Ok(tensor)
    }

    fn postprocess_output(
        &self,
        output: &ArrayD<f32>,
        confidence_threshold: f32,
    ) -> Vec<BoundingBox> {
        let mut detections = Vec::new();
        let dims = output.shape();

        if dims.len() == 3 {
            let is_transposed = dims[1] > dims[2];
            let (proposals_dim, classes_dim) = if is_transposed {
                (dims[1], dims[2])
            } else {
                (dims[2], dims[1])
            };

            let num_proposals = proposals_dim;
            let effective_class_count = std::cmp::min(
                classes_dim.saturating_sub(4),
                self.class_names.len(),
            );

            for i in 0..num_proposals {
                let mut max_class_id = 0;
                let mut max_score = 0.0f32;

                for c in 0..effective_class_count {
                    let score = if is_transposed {
                        output[[0, i, 4 + c]]
                    } else {
                        output[[0, 4 + c, i]]
                    };

                    if score > max_score {
                        max_score = score;
                        max_class_id = c;
                    }
                }

                if max_score > confidence_threshold {
                    let x = if is_transposed {
                        output[[0, i, 0]]
                    } else {
                        output[[0, 0, i]]
                    };
                    let y = if is_transposed {
                        output[[0, i, 1]]
                    } else {
                        output[[0, 1, i]]
                    };
                    let w = if is_transposed {
                        output[[0, i, 2]]
                    } else {
                        output[[0, 2, i]]
                    };
                    let h = if is_transposed {
                        output[[0, i, 3]]
                    } else {
                        output[[0, 3, i]]
                    };

                    detections.push(BoundingBox {
                        x,
                        y,
                        width: w,
                        height: h,
                        confidence: max_score,
                        class_id: max_class_id as i32,
                        class_name: self.class_names[max_class_id].clone(),
                    });
                }
            }
        }

        detections
    }

    fn apply_nms(&self, mut boxes: Vec<BoundingBox>, nms_threshold: f32) -> Vec<BoundingBox> {
        if boxes.is_empty() {
            return boxes;
        }

        boxes.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());

        let mut keep = Vec::new();
        let mut suppressed = vec![false; boxes.len()];

        for i in 0..boxes.len() {
            if suppressed[i] {
                continue;
            }

            keep.push(boxes[i].clone());

            for j in (i + 1)..boxes.len() {
                if suppressed[j] {
                    continue;
                }

                if boxes[i].class_id == boxes[j].class_id {
                    let iou = self.calculate_iou(&boxes[i], &boxes[j]);
                    if iou >= nms_threshold {
                        suppressed[j] = true;
                    }
                }
            }
        }

        keep
    }

    fn calculate_iou(&self, box1: &BoundingBox, box2: &BoundingBox) -> f32 {
        let inter_left = box1.left().max(box2.left());
        let inter_top = box1.top().max(box2.top());
        let inter_right = box1.right().min(box2.right());
        let inter_bottom = box1.bottom().min(box2.bottom());

        let inter_width = (inter_right - inter_left).max(0.0);
        let inter_height = (inter_bottom - inter_top).max(0.0);
        let inter_area = inter_width * inter_height;

        let union_area = box1.area() + box2.area() - inter_area;

        if union_area > 0.0 {
            inter_area / union_area
        } else {
            0.0
        }
    }
}

fn parse_class_names(names_str: &str) -> Vec<String> {
    let mut names = Vec::new();
    let cleaned = names_str.replace('{', "").replace('}', "").replace('\'', "");

    for part in cleaned.split(',') {
        let parts: Vec<&str> = part.split(':').collect();
        if parts.len() >= 2 {
            let name = parts[1..].join(":").trim().to_string();
            if !name.is_empty() {
                names.push(name);
            }
        }
    }

    names
}
