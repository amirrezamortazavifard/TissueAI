use burn::module::Module;
use burn::nn;
use burn::tensor::{backend::Backend, Tensor};

#[derive(Debug, Module)]
pub struct ConvBnRelu<B: Backend> {
    conv: nn::conv::Conv2d<B>,
    bn: nn::BatchNorm<B>,
}

impl<B: Backend> ConvBnRelu<B> {
    pub fn new(
        in_channels: usize,
        out_channels: usize,
        kernel_size: [usize; 2],
        stride: [usize; 2],
        pad: usize,
        device: &B::Device,
    ) -> Self {
        let conv = nn::conv::Conv2dConfig::new([in_channels, out_channels], kernel_size)
            .with_stride(stride)
            .with_padding(nn::PaddingConfig2d::Explicit(pad, pad, pad, pad))
            .init::<B>(device);
        let bn = nn::BatchNormConfig::new(out_channels).init::<B>(device);
        Self { conv, bn }
    }

    pub fn forward(&self, x: Tensor<B, 4>) -> Tensor<B, 4> {
        let x = self.conv.forward(x);
        let x = self.bn.forward(x);
        burn::tensor::activation::silu(x)
    }
}

#[derive(Debug, Module)]
pub struct ResidualBlock<B: Backend> {
    conv1: ConvBnRelu<B>,
    conv2: nn::conv::Conv2d<B>,
}

impl<B: Backend> ResidualBlock<B> {
    pub fn new(channels: usize, device: &B::Device) -> Self {
        let conv1 = ConvBnRelu::new(channels, channels, [3, 3], [1, 1], 1, device);
        let conv2 = nn::conv::Conv2dConfig::new([channels, channels], [3, 3])
            .with_padding(nn::PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        Self { conv1, conv2 }
    }

    pub fn forward(&self, x: Tensor<B, 4>) -> Tensor<B, 4> {
        let residual = x.clone();
        let x = self.conv1.forward(x);
        let x = self.conv2.forward(x);
        x + residual
    }
}

#[derive(Debug, Module)]
pub struct CspStage<B: Backend> {
    conv_down: ConvBnRelu<B>,
    conv1: ConvBnRelu<B>,
    conv2: ConvBnRelu<B>,
    residual: ResidualBlock<B>,
    conv_merge: ConvBnRelu<B>,
}

impl<B: Backend> CspStage<B> {
    pub fn new(in_channels: usize, out_channels: usize, device: &B::Device) -> Self {
        let half = out_channels / 2;
        let conv_down = ConvBnRelu::new(in_channels, out_channels, [3, 3], [2, 2], 1, device);
        let conv1 = ConvBnRelu::new(half, half, [1, 1], [1, 1], 0, device);
        let conv2 = ConvBnRelu::new(half, half, [1, 1], [1, 1], 0, device);
        let residual = ResidualBlock::new(half, device);
        let conv_merge = ConvBnRelu::new(out_channels, out_channels, [1, 1], [1, 1], 0, device);
        Self { conv_down, conv1, conv2, residual, conv_merge }
    }

    pub fn forward(&self, x: Tensor<B, 4>) -> Tensor<B, 4> {
        let x = self.conv_down.forward(x);
        let [_bs, ch, _h, _w] = x.dims();
        let half_ch = ch / 2;
        let x1 = x.clone().slice([0..1, 0..half_ch, 0..100000, 0..100000]).reshape([-1, half_ch as i32, x.dims()[2] as i32, x.dims()[3] as i32]);
        let x2 = x.clone().slice([0..1, half_ch..ch, 0..100000, 0..100000]).reshape([-1, half_ch as i32, x.dims()[2] as i32, x.dims()[3] as i32]);
        let x1 = self.conv1.forward(x1);
        let x2 = self.residual.forward(x2);
        let x2 = self.conv2.forward(x2);
        let x = Tensor::cat(vec![x1, x2], 1);
        self.conv_merge.forward(x)
    }
}

#[derive(Debug, Module)]
pub struct DarknetBackbone<B: Backend> {
    stem: ConvBnRelu<B>,
    stage1: CspStage<B>,
    stage2: CspStage<B>,
    stage3: CspStage<B>,
    stage4: CspStage<B>,
    stage5: CspStage<B>,
}

impl<B: Backend> DarknetBackbone<B> {
    pub fn new(depth_mult: f32, device: &B::Device) -> Self {
        let width = |c: usize| ((c as f32 * depth_mult) as usize).max(8);
        Self {
            stem: ConvBnRelu::new(3, width(32), [3, 3], [1, 1], 1, device),
            stage1: CspStage::new(width(32), width(64), device),
            stage2: CspStage::new(width(64), width(128), device),
            stage3: CspStage::new(width(128), width(256), device),
            stage4: CspStage::new(width(256), width(512), device),
            stage5: CspStage::new(width(512), width(1024), device),
        }
    }

    pub fn forward(&self, x: Tensor<B, 4>) -> Vec<Tensor<B, 4>> {
        let x = self.stem.forward(x);
        let x = self.stage1.forward(x);
        let x = self.stage2.forward(x);
        let p3 = self.stage3.forward(x);
        let p4 = self.stage4.forward(p3.clone());
        let p5 = self.stage5.forward(p4.clone());
        vec![p3, p4, p5]
    }
}

#[derive(Debug, Module)]
pub struct FpnNeck<B: Backend> {
    lateral1: nn::conv::Conv2d<B>,
    lateral2: nn::conv::Conv2d<B>,
    output1: ConvBnRelu<B>,
    output2: ConvBnRelu<B>,
    down_conv: ConvBnRelu<B>,
}

impl<B: Backend> FpnNeck<B> {
    pub fn new(channels: [usize; 3], device: &B::Device) -> Self {
        let c3 = channels[0];
        let c4 = channels[1];
        let c5 = channels[2];
        let lateral1 = nn::conv::Conv2dConfig::new([c5, c4], [1, 1]).init::<B>(device);
        let lateral2 = nn::conv::Conv2dConfig::new([c4, c3], [1, 1]).init::<B>(device);
        let output1 = ConvBnRelu::new(c5, c4, [3, 3], [1, 1], 1, device);
        let output2 = ConvBnRelu::new(c4, c3, [3, 3], [1, 1], 1, device);
        let down_conv = ConvBnRelu::new(c4, c4, [3, 3], [2, 2], 1, device);
        Self { lateral1, lateral2, output1, output2, down_conv }
    }

    pub fn forward(&self, features: Vec<Tensor<B, 4>>) -> Vec<Tensor<B, 4>> {
        let p3 = features[0].clone();
        let p4 = features[1].clone();
        let p5 = features[2].clone();

        let lat5 = self.lateral1.forward(p5.clone());
        let p4_up = upsample_nearest(lat5, p4.dims()[2], p4.dims()[3]);
        let p4_merge = p4 + p4_up;
        let out4 = self.output1.forward(p4_merge);

        let lat4 = self.lateral2.forward(out4.clone());
        let p3_up = upsample_nearest(lat4, p3.dims()[2], p3.dims()[3]);
        let p3_merge = p3 + p3_up;
        let out3 = self.output2.forward(p3_merge);

        let down = self.down_conv.forward(out4.clone());
        let p5_out = upsample_nearest(down, p5.dims()[2], p5.dims()[3]);
        let p5_out = p5 + p5_out;
        let out5 = self.output1.forward(p5_out);

        vec![out3, out4, out5]
    }
}

fn upsample_nearest<B: Backend>(x: Tensor<B, 4>, target_h: usize, target_w: usize) -> Tensor<B, 4> {
    let [_b, _c, h, w] = x.dims();
    let mut result = x;
    if h < target_h {
        result = result.repeat_dim(2, 2);
    }
    if w < target_w {
        result = result.repeat_dim(3, 2);
    }
    let [_, _, rh, rw] = result.dims();
    if rh > target_h || rw > target_w {
        result = result.slice([0..1, 0..100000, 0..target_h, 0..target_w]);
    }
    result
}

#[derive(Debug, Module)]
pub struct DetectHead<B: Backend> {
    cls_convs: Vec<ConvBnRelu<B>>,
    reg_convs: Vec<ConvBnRelu<B>>,
    cls_preds: Vec<nn::conv::Conv2d<B>>,
    reg_preds: Vec<nn::conv::Conv2d<B>>,
    obj_preds: Vec<nn::conv::Conv2d<B>>,
    num_classes: usize,
}

impl<B: Backend> DetectHead<B> {
    pub fn new(
        in_channels: &[usize],
        num_classes: usize,
        device: &B::Device,
    ) -> Self {
        let mut cls_convs = Vec::new();
        let mut reg_convs = Vec::new();
        let mut cls_preds = Vec::new();
        let mut reg_preds = Vec::new();
        let mut obj_preds = Vec::new();

        for &c in in_channels {
            cls_convs.push(ConvBnRelu::new(c, c, [3, 3], [1, 1], 1, device));
            reg_convs.push(ConvBnRelu::new(c, c, [3, 3], [1, 1], 1, device));
            cls_preds.push(
                nn::conv::Conv2dConfig::new([c, num_classes], [1, 1]).init::<B>(device),
            );
            reg_preds.push(
                nn::conv::Conv2dConfig::new([c, 4], [1, 1]).init::<B>(device),
            );
            obj_preds.push(
                nn::conv::Conv2dConfig::new([c, 1], [1, 1]).init::<B>(device),
            );
        }

        Self { cls_convs, reg_convs, cls_preds, reg_preds, obj_preds, num_classes }
    }

    pub fn forward(
        &self,
        features: Vec<Tensor<B, 4>>,
    ) -> (Tensor<B, 3>, Tensor<B, 3>, Tensor<B, 3>) {
        let mut all_obj = Vec::new();
        let mut all_cls = Vec::new();
        let mut all_reg = Vec::new();

        for (i, feat) in features.iter().enumerate() {
            let cls_feat = self.cls_convs[i].forward(feat.clone());
            let reg_feat = self.reg_convs[i].forward(feat.clone());
            let obj_pred = self.obj_preds[i].forward(cls_feat.clone());
            let cls_pred = self.cls_preds[i].forward(cls_feat);
            let reg_pred = self.reg_preds[i].forward(reg_feat);

            let [_bs, _ch, h, w] = cls_pred.dims();
            let batch_size = cls_pred.dims()[0];

            let obj_pred = obj_pred.reshape([batch_size as i32, 1, (h * w) as i32]);
            let cls_pred = cls_pred.reshape([batch_size as i32, self.num_classes as i32, (h * w) as i32]);
            let reg_pred = reg_pred.reshape([batch_size as i32, 4, (h * w) as i32]);

            all_obj.push(obj_pred);
            all_cls.push(cls_pred);
            all_reg.push(reg_pred);
        }

        let obj_output = Tensor::cat(all_obj, 2);
        let cls_output = Tensor::cat(all_cls, 2);
        let reg_output = Tensor::cat(all_reg, 2);

        (obj_output, cls_output, reg_output)
    }
}

#[derive(Debug, Module)]
pub struct YoloxModel<B: Backend> {
    pub backbone: DarknetBackbone<B>,
    pub neck: FpnNeck<B>,
    pub head: DetectHead<B>,
    pub num_classes: usize,
}

impl<B: Backend> YoloxModel<B> {
    pub fn new(num_classes: usize, depth_mult: f32, device: &B::Device) -> Self {
        let backbone = DarknetBackbone::new(depth_mult, device);
        let width = |c: usize| ((c as f32 * depth_mult) as usize).max(8);
        let neck_channels = [width(256), width(512), width(1024)];
        let neck = FpnNeck::new(neck_channels, device);
        let head_in_channels = [width(256), width(512), width(1024)];
        let head = DetectHead::new(&head_in_channels, num_classes, device);

        Self { backbone, neck, head, num_classes }
    }

    pub fn forward(&self, images: Tensor<B, 4>) -> (Tensor<B, 3>, Tensor<B, 3>, Tensor<B, 3>) {
        let features = self.backbone.forward(images);
        let features = self.neck.forward(features);
        self.head.forward(features)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[allow(dead_code)]
pub struct BBox {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub class_id: usize,
    pub confidence: f32,
}

#[allow(dead_code)]
pub fn nms(boxes: &[BBox], iou_threshold: f32) -> Vec<usize> {
    if boxes.is_empty() {
        return Vec::new();
    }

    let mut sorted: Vec<(usize, &BBox)> = boxes.iter().enumerate().collect();
    sorted.sort_by(|a, b| b.1.confidence.partial_cmp(&a.1.confidence).unwrap());

    let mut keep = Vec::new();
    let mut suppressed = vec![false; boxes.len()];

    for (idx, (i, box_i)) in sorted.iter().enumerate() {
        if suppressed[idx] {
            continue;
        }
        keep.push(*i);

        for (jdx, (_j, box_j)) in sorted.iter().enumerate().skip(idx + 1) {
            if suppressed[jdx] {
                continue;
            }
            let iou = compute_iou(box_i, box_j);
            if iou > iou_threshold {
                suppressed[jdx] = true;
            }
        }
    }

    keep
}

#[allow(dead_code)]
fn compute_iou(a: &BBox, b: &BBox) -> f32 {
    let x1 = a.x1.max(b.x1);
    let y1 = a.y1.max(b.y1);
    let x2 = a.x2.min(b.x2);
    let y2 = a.y2.min(b.y2);

    let inter = (x2 - x1).max(0.0) * (y2 - y1).max(0.0);
    let area_a = (a.x2 - a.x1) * (a.y2 - a.y1);
    let area_b = (b.x2 - b.x1) * (b.y2 - b.y1);
    let union = area_a + area_b - inter;

    if union <= 0.0 { 0.0 } else { inter / union }
}

#[allow(dead_code)]
pub fn decode_predictions(
    obj_logits: &[f32],
    cls_logits: &[f32],
    reg_preds: &[f32],
    num_classes: usize,
    num_anchors: usize,
    input_h: usize,
    input_w: usize,
    conf_threshold: f32,
    strides: &[usize; 3],
) -> Vec<BBox> {
    let mut boxes = Vec::new();

    let h3 = input_h / strides[0];
    let w3 = input_w / strides[0];
    let h4 = input_h / strides[1];
    let w4 = input_w / strides[1];
    let h5 = input_h / strides[2];
    let w5 = input_w / strides[2];

    let sizes = [(h3, w3, strides[0]), (h4, w4, strides[1]), (h5, w5, strides[2])];
    let mut offset = 0;

    for (h, w, stride) in sizes {
        for yi in 0..h {
            for xi in 0..w {
                let idx = offset + yi * w + xi;
                if idx >= num_anchors {
                    continue;
                }

                let obj_logit = obj_logits[idx];
                let obj_conf = sigmoid(obj_logit);

                if obj_conf < conf_threshold {
                    continue;
                }

                let mut max_cls = f32::NEG_INFINITY;
                let mut max_cls_id = 0;
                for c in 0..num_classes {
                    let cls_idx = c * num_anchors + idx;
                    if cls_idx < cls_logits.len() {
                        let v = cls_logits[cls_idx];
                        if v > max_cls {
                            max_cls = v;
                            max_cls_id = c;
                        }
                    }
                }

                let score = obj_conf * sigmoid(max_cls);
                if score < conf_threshold {
                    continue;
                }

                let dx = reg_preds[0 * num_anchors + idx];
                let dy = reg_preds[1 * num_anchors + idx];
                let dw = reg_preds[2 * num_anchors + idx];
                let dh = reg_preds[3 * num_anchors + idx];

                let cx = (xi as f32 + sigmoid(dx)) * stride as f32;
                let cy = (yi as f32 + sigmoid(dy)) * stride as f32;
                let bw = dw.exp() * stride as f32;
                let bh = dh.exp() * stride as f32;

                boxes.push(BBox {
                    x1: cx - bw / 2.0,
                    y1: cy - bh / 2.0,
                    x2: cx + bw / 2.0,
                    y2: cy + bh / 2.0,
                    class_id: max_cls_id,
                    confidence: score,
                });
            }
        }
        offset += h * w;
    }

    boxes
}

#[allow(dead_code)]
pub fn compute_yolox_loss<B: Backend>(
    obj_pred: Tensor<B, 3>,
    cls_pred: Tensor<B, 3>,
    reg_pred: Tensor<B, 3>,
    obj_target: Tensor<B, 3>,
    cls_target: Tensor<B, 3>,
    reg_target: Tensor<B, 3>,
    device: &B::Device,
) -> Tensor<B, 1> {
    let bce = nn::loss::BinaryCrossEntropyLossConfig::new().init::<B>(device);
    let mse = nn::loss::MseLoss::new();

    let obj_loss = bce.forward(obj_pred.clone(), obj_target.clone().int());
    let cls_loss = bce.forward(cls_pred, cls_target.int());
    let reg_loss = mse.forward(
        reg_pred.clone(),
        reg_target,
        nn::loss::Reduction::Mean,
    );

    obj_loss + cls_loss + reg_loss
}

#[allow(dead_code)]
fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}
