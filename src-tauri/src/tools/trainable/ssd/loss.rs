use burn::nn::loss::HuberLossConfig;
use burn::tensor::{Tensor, backend::Backend};

use super::boxes::{
    generate_all_default_boxes, get_overlapping_dflt_boxes, box_regression,
    target_lbls_to_default_boxes,
};

use burn::prelude::Int;

pub struct SSDLossInput<B: Backend> {
    pub class_logits: Tensor<B, 3>,
    pub bbox_logits: Tensor<B, 3>,
    pub layer_outputs: [Tensor<B, 4>; 6],
    pub gt_boxes: Tensor<B, 2>,
    pub target_labels: Tensor<B, 1, Int>,
}

fn cross_entropy_loss<B: Backend>(
    logits: Tensor<B, 2>,
    targets: Tensor<B, 1, Int>,
) -> Tensor<B, 1> {
    let box_count = targets.dims()[0];
    let log_probabilities = burn::tensor::activation::log_softmax(logits, 1);
    let targets = targets.clone().reshape([box_count, 1]);
    let nll = log_probabilities.gather(1, targets) * -1.0;
    nll.reshape([box_count])
}

pub fn calculate_loss<B: Backend>(input: SSDLossInput<B>) -> Tensor<B, 1> {
    let device = &input.class_logits.device();
    let dflt_bxs = generate_all_default_boxes(&input.layer_outputs);
    let num_default_boxes = dflt_bxs.dims()[0];

    let gt_boxes = input.gt_boxes;
    let target_labels = input.target_labels;
    let bbox_logits_3d = input.bbox_logits;
    let class_logits_3d = input.class_logits;

    let matching_dflt_boxes = get_overlapping_dflt_boxes(
        gt_boxes.clone(),
        dflt_bxs.clone(),
        0.5,
    );

    let matching_int = matching_dflt_boxes.clone().add_scalar(1).bool().nonzero();
    let flat_data: Vec<i32> = if matching_int.is_empty() {
        Vec::new()
    } else {
        let mut all = Vec::new();
        for tensor in matching_int {
            let v: Vec<i32> = tensor.into_data().to_vec::<i32>().unwrap_or_default();
            all.extend(v);
        }
        all
    };

    if flat_data.is_empty() {
        return Tensor::zeros([1], device);
    }

    let dflt_indexes = Tensor::<B, 1, Int>::from_data(flat_data.as_slice(), device);

    let gt_bx_matches = gt_boxes.clone().select(
        0,
        matching_dflt_boxes.clone().select(0, dflt_indexes.clone()),
    );
    let dflt_bx_matches = dflt_bxs.clone().select(0, dflt_indexes.clone());

    let box_trans = box_regression(gt_bx_matches, dflt_bx_matches, (10.0, 10.0, 5.0, 5.0));

    // bbox_logits_3d is [1, num_boxes, 4] - squeeze to [num_boxes, 4]
    let bbox_logits = bbox_logits_3d.squeeze::<2>();
    let class_logits = class_logits_3d.squeeze::<2>();

    let pred_boxes_trans: Tensor<B, 2> = bbox_logits.select(0, dflt_indexes.clone());

    let huber_loss = HuberLossConfig::new(0.5).init();
    let pred_box_loss = huber_loss.forward(pred_boxes_trans, box_trans, burn::nn::loss::Reduction::Mean);

    let cls_boxes = target_lbls_to_default_boxes(
        &matching_dflt_boxes,
        target_labels,
        num_default_boxes,
    );

    let conf_loss = cross_entropy_loss(class_logits, cls_boxes.clone());

    let fg_label_mask = cls_boxes.clone().greater_elem(0);
    let fg_count_data: i32 = {
        let val = fg_label_mask.clone().int().sum();
        let raw: Vec<i32> = val.into_data().to_vec::<i32>().unwrap_or_default();
        raw.into_iter().next().unwrap_or(0)
    };
    let hard_neg_cnt_max = (fg_count_data * 3) as usize;

    let fg_index_map = Tensor::cat(fg_label_mask.nonzero(), 0);

    let conf_loss_data: Vec<f32> = conf_loss.clone().into_data().to_vec::<f32>().unwrap_or_default();
    let fg_data: Vec<i32> = fg_index_map.clone().into_data().to_vec::<i32>().unwrap_or_default();
    let mut hrd_neg_loss_data = conf_loss_data;
    for &idx in &fg_data {
        if idx >= 0 && (idx as usize) < hrd_neg_loss_data.len() {
            hrd_neg_loss_data[idx as usize] = f32::NEG_INFINITY;
        }
    }
    let hrd_neg_loss = Tensor::<B, 1>::from_floats(hrd_neg_loss_data.as_slice(), device);

    let (_vals, bg_index_map) = hrd_neg_loss.sort_descending_with_indices(0);
    let bg_index_map = bg_index_map.slice(0..hard_neg_cnt_max);

    let n = dflt_indexes.dims()[0] as f32;

    if n >= 1.0 {
        let alpha: f32 = 1.0;
        let lconf = conf_loss.clone().select(0, fg_index_map).sum()
            + conf_loss.select(0, bg_index_map).sum();
        let lloc = pred_box_loss.sum();
        (lconf + alpha * lloc) / n
    } else {
        Tensor::zeros([1], device)
    }
}
