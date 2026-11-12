use burn::backend::{Autodiff, NdArray};
use burn::module::{Module, AutodiffModule};
use burn::nn::loss::BinaryCrossEntropyLossConfig;
use burn::optim::{AdamConfig, GradientsParams, Optimizer};
use burn::record::{BinGzFileRecorder, FullPrecisionSettings};
use burn::tensor::Tensor;
use std::path::Path;

use super::dataset::DetectionDataset;
use super::yolox::YoloxModel;

type B = NdArray;
type AB = Autodiff<B>;

pub struct TrainConfig {
    pub num_classes: usize,
    pub epochs: usize,
    pub batch_size: usize,
    pub learning_rate: f64,
    pub model_size: String,
}

pub struct TrainResult {
    pub loss_history: Vec<f32>,
    pub final_loss: f32,
    pub epochs_trained: usize,
    pub model_path: String,
}

use tauri::Emitter;

#[derive(Clone, serde::Serialize)]
pub struct TrainingProgressPayload {
    pub epoch: usize,
    pub total_epochs: usize,
    pub loss: f32,
    pub message: String,
}

pub fn train_yolox(
    dataset: &DetectionDataset,
    _classes: &[(usize, String)],
    config: &TrainConfig,
    output_dir: &str,
    app_handle: Option<&tauri::AppHandle>,
) -> Result<TrainResult, String> {
    let device = Default::default();
    let depth_mult = match config.model_size.as_str() {
        "yolox-nano" => 0.33,
        "yolox-tiny" => 0.33,
        "yolox-s" => 0.33,
        "yolox-m" => 0.67,
        "yolox-l" => 1.0,
        "yolox-x" => 1.33,
        _ => 0.33,
    };

    let mut model: YoloxModel<AB> = YoloxModel::new(config.num_classes, depth_mult, &device);
    let opt_config = AdamConfig::new()
        .with_beta_1(0.9)
        .with_beta_2(0.999)
        .with_epsilon(1e-7);
    let mut opt = opt_config.init::<AB, YoloxModel<AB>>();

    let input_h = 640usize;
    let input_w = 640usize;
    let bce = BinaryCrossEntropyLossConfig::new().init::<AB>(&device);

    let mut loss_history = Vec::new();
    let mut last_loss = 0.0f32;

    let items = dataset.items();
    if items.is_empty() {
        return Err("No training items found".to_string());
    }

    for epoch in 0..config.epochs {
        let mut epoch_loss = 0.0f32;
        let mut num_batches = 0usize;

        let batch_count = items.len();

        for idx in 0..batch_count {
            let item = &items[idx];
            let img = match image::open(&item.image_path) {
                Ok(img) => img,
                Err(_) => continue,
            };
            let img = img.resize_exact(
                input_w as u32,
                input_h as u32,
                image::imageops::FilterType::Lanczos3,
            );
            let img = img.to_rgb8();

            let mut pixel_data = vec![0.0f32; 3 * input_h * input_w];
            for y in 0..input_h {
                for x in 0..input_w {
                    let p = img.get_pixel(x as u32, y as u32);
                    pixel_data[y * input_w + x] = p[0] as f32 / 255.0;
                    pixel_data[input_h * input_w + y * input_w + x] = p[1] as f32 / 255.0;
                    pixel_data[2 * input_h * input_w + y * input_w + x] = p[2] as f32 / 255.0;
                }
            }

            let input_1d: Tensor<AB, 1> = Tensor::from_data(pixel_data.as_slice(), &device);
            let input: Tensor<AB, 4> =
                input_1d.reshape([1i64, 3, input_h as i64, input_w as i64]);

            let num_anchors = (input_h / 8) * (input_w / 8)
                + (input_h / 16) * (input_w / 16)
                + (input_h / 32) * (input_w / 32);

            let mut obj_target_vec = vec![0.0f32; num_anchors];
            let mut cls_target_vec = vec![0.0f32; config.num_classes * num_anchors];
            let mut reg_target_vec = vec![0.0f32; 4 * num_anchors];

            for bbox in &item.bboxes {
                let cx = bbox.x_center * input_w as f32;
                let cy = bbox.y_center * input_h as f32;
                let bw = bbox.width * input_w as f32;
                let bh = bbox.height * input_h as f32;

                let (feat_h, feat_w, stride, offset) = if bw * bh < 32.0 * 32.0 {
                    (
                        input_h / 16,
                        input_w / 16,
                        16,
                        (input_h / 8) * (input_w / 8),
                    )
                } else if bw * bh < 96.0 * 96.0 {
                    (input_h / 8, input_w / 8, 8, 0)
                } else {
                    (
                        input_h / 32,
                        input_w / 32,
                        32,
                        (input_h / 8) * (input_w / 8) + (input_h / 16) * (input_w / 16),
                    )
                };

                let grid_x = (cx / stride as f32).floor() as usize;
                let grid_y = (cy / stride as f32).floor() as usize;
                if grid_y < feat_h && grid_x < feat_w {
                    let anchor_idx = offset + grid_y * feat_w + grid_x;
                    if anchor_idx < num_anchors {
                        obj_target_vec[anchor_idx] = 1.0;
                        let class_id = bbox.class_id.min(config.num_classes.saturating_sub(1));
                        cls_target_vec[class_id * num_anchors + anchor_idx] = 1.0;

                        let dx = (cx / stride as f32) - (grid_x as f32);
                        let dy = (cy / stride as f32) - (grid_y as f32);
                        let dw = (bw / stride as f32).max(1e-4).ln();
                        let dh = (bh / stride as f32).max(1e-4).ln();

                        reg_target_vec[0 * num_anchors + anchor_idx] = dx;
                        reg_target_vec[1 * num_anchors + anchor_idx] = dy;
                        reg_target_vec[2 * num_anchors + anchor_idx] = dw;
                        reg_target_vec[3 * num_anchors + anchor_idx] = dh;
                    }
                }
            }

            let obj_target: Tensor<AB, 3> = Tensor::<AB, 1>::from_floats(obj_target_vec.as_slice(), &device)
                .reshape([1, 1, num_anchors]);
            let cls_target: Tensor<AB, 3> = Tensor::<AB, 1>::from_floats(cls_target_vec.as_slice(), &device)
                .reshape([1, config.num_classes, num_anchors]);
            let reg_target: Tensor<AB, 3> = Tensor::<AB, 1>::from_floats(reg_target_vec.as_slice(), &device)
                .reshape([1, 4, num_anchors]);

            let (obj_pred, cls_pred, reg_pred) = model.forward(input);

            let obj_loss = bce.forward(obj_pred, obj_target.clone().int());
            let cls_loss = bce.forward(cls_pred, cls_target.clone().int());
            let reg_loss = (reg_pred - reg_target).powf_scalar(2.0).mean();

            let loss = obj_loss + cls_loss + reg_loss * 0.01;

            last_loss = loss.clone().into_scalar();
            let grads = loss.backward();
            let grads = GradientsParams::from_grads(grads, &model);
            model = opt.step(config.learning_rate, model, grads);

            epoch_loss += last_loss;
            num_batches += 1;
        }

        let avg_loss = if num_batches > 0 {
            epoch_loss / num_batches as f32
        } else {
            0.0
        };
        loss_history.push(avg_loss);
        if let Some(app) = app_handle {
            let _ = app.emit("training-progress", TrainingProgressPayload {
                epoch: epoch + 1,
                total_epochs: config.epochs,
                loss: avg_loss,
                message: format!("Epoch {}/{} - Loss: {:.6}", epoch + 1, config.epochs, avg_loss),
            });
        }
        eprintln!(
            "Epoch {}/{} - Loss: {:.6}",
            epoch + 1,
            config.epochs,
            avg_loss
        );
    }

    let model = model.no_grad().valid();

    let out_path = Path::new(output_dir);
    std::fs::create_dir_all(out_path).map_err(|e| e.to_string())?;
    let model_file = out_path.join("yolox_model.bin.gz");
    let recorder = BinGzFileRecorder::<FullPrecisionSettings>::default();
    model
        .save_file(model_file.to_str().unwrap(), &recorder)
        .map_err(|e| format!("Failed to save model: {:?}", e))?;

    Ok(TrainResult {
        loss_history,
        final_loss: last_loss,
        epochs_trained: config.epochs,
        model_path: model_file.to_str().unwrap().to_string(),
    })
}
