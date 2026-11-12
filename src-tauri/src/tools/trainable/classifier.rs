use serde::{Deserialize, Serialize};
use rand::Rng;
use rand::seq::SliceRandom;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingSettings {
    pub hidden_layers: Vec<usize>,
    pub learning_rate: f32,
    pub epochs: usize,
    pub batch_size: usize,
}

impl Default for TrainingSettings {
    fn default() -> Self {
        Self {
            hidden_layers: vec![64, 32],
            learning_rate: 0.001,
            epochs: 100,
            batch_size: 32,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingResult {
    pub loss_history: Vec<f32>,
    pub accuracy: f32,
    pub num_classes: usize,
    pub feature_count: usize,
    pub epochs_trained: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MlpModel {
    pub weights: Vec<Vec<Vec<f32>>>,
    pub biases: Vec<Vec<f32>>,
    pub feature_count: usize,
    pub num_classes: usize,
    pub hidden_layers: Vec<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassInfo {
    pub id: u32,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingSample {
    pub features: Vec<f32>,
    pub label: usize,
}

struct AdamOptimizer {
    m_w: Vec<Vec<Vec<f32>>>,
    v_w: Vec<Vec<Vec<f32>>>,
    m_b: Vec<Vec<f32>>,
    v_b: Vec<Vec<f32>>,
    t: usize,
    beta1: f32,
    beta2: f32,
    epsilon: f32,
}

impl AdamOptimizer {
    fn new(model: &MlpModel) -> Self {
        let m_w: Vec<Vec<Vec<f32>>> = model.weights.iter().map(|l| {
            l.iter().map(|r| vec![0.0; r.len()]).collect()
        }).collect();
        let v_w = m_w.clone();
        let m_b: Vec<Vec<f32>> = model.biases.iter().map(|b| vec![0.0; b.len()]).collect();
        let v_b = m_b.clone();
        Self { m_w, v_w, m_b, v_b, t: 0, beta1: 0.9, beta2: 0.999, epsilon: 1e-8 }
    }

    fn update(&mut self, model: &mut MlpModel, grad_w: &[Vec<Vec<f32>>], grad_b: &[Vec<f32>], lr: f32) {
        self.t += 1;
        let t = self.t as f32;
        let bc1 = 1.0 - self.beta1.powf(t);
        let bc2 = 1.0 - self.beta2.powf(t);

        for l in 0..model.weights.len() {
            for i in 0..model.weights[l].len() {
                for j in 0..model.weights[l][i].len() {
                    self.m_w[l][i][j] = self.beta1 * self.m_w[l][i][j] + (1.0 - self.beta1) * grad_w[l][i][j];
                    self.v_w[l][i][j] = self.beta2 * self.v_w[l][i][j] + (1.0 - self.beta2) * grad_w[l][i][j] * grad_w[l][i][j];
                    let mw = self.m_w[l][i][j] / bc1;
                    let vw = self.v_w[l][i][j] / bc2;
                    model.weights[l][i][j] -= lr * mw / (vw.sqrt() + self.epsilon);
                }
                self.m_b[l][i] = self.beta1 * self.m_b[l][i] + (1.0 - self.beta1) * grad_b[l][i];
                self.v_b[l][i] = self.beta2 * self.v_b[l][i] + (1.0 - self.beta2) * grad_b[l][i] * grad_b[l][i];
                let mb = self.m_b[l][i] / bc1;
                let vb = self.v_b[l][i] / bc2;
                model.biases[l][i] -= lr * mb / (vb.sqrt() + self.epsilon);
            }
        }
    }
}

fn relu(x: f32) -> f32 {
    x.max(0.0)
}

fn relu_deriv(x: f32) -> f32 {
    if x > 0.0 { 1.0 } else { 0.0 }
}

fn softmax(logits: &[f32]) -> Vec<f32> {
    let max = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let exps: Vec<f32> = logits.iter().map(|&x| (x - max).exp()).collect();
    let sum: f32 = exps.iter().sum();
    exps.iter().map(|&x| x / sum).collect()
}

pub fn initialize_mlp(feature_count: usize, num_classes: usize, hidden_layers: &[usize]) -> MlpModel {
    let mut rng = rand::thread_rng();
    let mut weights = Vec::new();
    let mut biases = Vec::new();

    let mut prev_size = feature_count;
    let mut layer_sizes = hidden_layers.to_vec();
    layer_sizes.push(num_classes);

    for &size in &layer_sizes {
        let scale = (2.0 / prev_size as f32).sqrt();
        let w: Vec<Vec<f32>> = (0..size)
            .map(|_| (0..prev_size).map(|_| rng.gen_range(-scale..scale)).collect())
            .collect();
        let b = vec![0.0; size];
        weights.push(w);
        biases.push(b);
        prev_size = size;
    }

    MlpModel { weights, biases, feature_count, num_classes, hidden_layers: hidden_layers.to_vec() }
}

struct LayerActivations {
    pre_activations: Vec<Vec<f32>>,
    activations: Vec<Vec<f32>>,
}

fn forward(model: &MlpModel, input: &[f32]) -> (Vec<f32>, LayerActivations) {
    let mut current = input.to_vec();
    let mut pre_acts = Vec::new();
    let mut acts = Vec::new();
    acts.push(current.clone());

    for l in 0..model.weights.len() {
        let mut output = vec![0.0; model.weights[l].len()];
        for i in 0..model.weights[l].len() {
            let mut sum = model.biases[l][i];
            for j in 0..current.len() {
                sum += model.weights[l][i][j] * current[j];
            }
            output[i] = sum;
        }
        pre_acts.push(output.clone());
        if l < model.weights.len() - 1 {
            output = output.iter().map(|&x| relu(x)).collect();
        } else {
            output = softmax(&output);
        }
        current = output;
        acts.push(current.clone());
    }

    (current, LayerActivations { pre_activations: pre_acts, activations: acts })
}

fn cross_entropy_loss(predictions: &[f32], label: usize) -> f32 {
    -(predictions[label] + 1e-8).ln()
}

pub fn train_model(
    model: &mut MlpModel,
    samples: &[TrainingSample],
    settings: &TrainingSettings,
) -> TrainingResult {
    let mut rng = rand::thread_rng();
    let mut optimizer = AdamOptimizer::new(model);
    let mut loss_history = Vec::new();
    let num_layers = model.weights.len();

    for _epoch in 0..settings.epochs {
        let mut indices: Vec<usize> = (0..samples.len()).collect();
        indices.shuffle(&mut rng);

        let mut epoch_loss = 0.0;
        let mut _correct = 0;
        let mut total = 0;

        for chunk in indices.chunks(settings.batch_size) {
            let mut grad_w: Vec<Vec<Vec<f32>>> = model.weights.iter().map(|l| {
                l.iter().map(|r| vec![0.0; r.len()]).collect()
            }).collect();
            let mut grad_b: Vec<Vec<f32>> = model.biases.iter().map(|b| vec![0.0; b.len()]).collect();

            for &idx in chunk {
                let sample = &samples[idx];
                let (prediction, acts) = forward(model, &sample.features);
                let loss = cross_entropy_loss(&prediction, sample.label);
                epoch_loss += loss;
                total += 1;

                let predicted_class = prediction.iter().enumerate()
                    .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
                    .map(|(i, _)| i)
                    .unwrap_or(0);
                if predicted_class == sample.label {
                    _correct += 1;
                }

                let mut delta = vec![0.0; model.num_classes];
                for c in 0..model.num_classes {
                    delta[c] = prediction[c] - if c == sample.label { 1.0 } else { 0.0 };
                }

                for l in (0..num_layers).rev() {
                    let input = &acts.activations[l];
                    let mut new_delta = vec![0.0; input.len()];

                    for i in 0..model.weights[l].len() {
                        for j in 0..input.len() {
                            grad_w[l][i][j] += delta[i] * input[j];
                        }
                        grad_b[l][i] += delta[i];
                    }

                    if l > 0 {
                        for j in 0..input.len() {
                            let mut sum = 0.0;
                            for i in 0..model.weights[l].len() {
                                sum += model.weights[l][i][j] * delta[i];
                            }
                            new_delta[j] = sum * relu_deriv(acts.pre_activations[l - 1][j]);
                        }
                        delta = new_delta;
                    }
                }
            }

            let batch_size = chunk.len() as f32;
            for l in 0..num_layers {
                for i in 0..grad_w[l].len() {
                    for j in 0..grad_w[l][i].len() {
                        grad_w[l][i][j] /= batch_size;
                    }
                    grad_b[l][i] /= batch_size;
                }
            }

            optimizer.update(model, &grad_w, &grad_b, settings.learning_rate);
        }

        loss_history.push(epoch_loss / total as f32);
    }

    let final_accuracy = {
        let mut correct = 0;
        for sample in samples {
            let (pred, _) = forward(model, &sample.features);
            let predicted_class = pred.iter().enumerate()
                .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
                .map(|(i, _)| i)
                .unwrap_or(0);
            if predicted_class == sample.label {
                correct += 1;
            }
        }
        correct as f32 / samples.len() as f32
    };

    TrainingResult {
        loss_history,
        accuracy: final_accuracy,
        num_classes: model.num_classes,
        feature_count: model.feature_count,
        epochs_trained: settings.epochs,
    }
}

pub fn predict(model: &MlpModel, features: &[f32]) -> (usize, Vec<f32>) {
    let (probs, _) = forward(model, features);
    let predicted_class = probs.iter().enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
        .map(|(i, _)| i)
        .unwrap_or(0);
    (predicted_class, probs)
}

pub fn save_model(model: &MlpModel, path: &str) -> Result<(), String> {
    let json = serde_json::to_string_pretty(model).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

pub fn load_model(path: &str) -> Result<MlpModel, String> {
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[allow(dead_code)]
pub fn predict_image(
    model: &MlpModel,
    feature_maps: &super::feature_extractor::FeatureMaps,
    width: u32,
    height: u32,
) -> Vec<u32> {
    let mut result = vec![0u32; (width * height) as usize];
    for y in 0..height {
        for x in 0..width {
            let fv = super::feature_extractor::get_feature_vector(feature_maps, x, y);
            let (class, _) = predict(model, &fv);
            result[(y * width + x) as usize] = class as u32;
        }
    }
    result
}
