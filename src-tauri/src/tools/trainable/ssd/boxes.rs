use burn::prelude::Backend;
use burn::tensor::{Tensor, Int};

use super::layers::SSDConvLayers;

pub fn get_box_count_for_layer(conv: &SSDConvLayers) -> usize {
    ar(conv).len() + 1
}

pub fn get_default_boxes(conv: &SSDConvLayers) -> Vec<(f32, f32)> {
    let mut box_sizes = Vec::<(f32, f32)>::new();
    let k = conv.get_id();
    box_sizes.push(ar1(k));
    for ar_val in ar(conv).iter() {
        box_sizes.push((wk(k, *ar_val), hk(k, *ar_val)));
    }
    box_sizes
}

pub fn target_lbls_to_default_boxes<B: Backend>(
    matching_boxes: &Tensor<B, 1, Int>,
    target_labels: Tensor<B, 1, Int>,
    num_default_boxes: usize,
) -> Tensor<B, 1, Int> {
    let device = &matching_boxes.device();
    let mb_mask = matching_boxes.clone().greater_elem(-1);
    let labels_index = Tensor::cat(mb_mask.clone().nonzero(), 0);

    let index_vec: Vec<i32> = (0..num_default_boxes).map(|x| x as i32).collect();
    let index_map = Tensor::<B, 1, Int>::from_data(index_vec.as_slice(), device);

    let boxes_index = matching_boxes.clone().select(0, labels_index.clone());
    let zeros = Tensor::<B, 1, Int>::zeros([num_default_boxes], device);
    let selected_idx = index_map.select(0, labels_index);
    let selected_val = target_labels.select(0, boxes_index);

    let mut result_data: Vec<i32> = zeros.into_data().to_vec::<i32>().unwrap_or_default();
    let idx_data: Vec<i32> = selected_idx.into_data().to_vec::<i32>().unwrap_or_default();
    let val_data: Vec<i32> = selected_val.into_data().to_vec::<i32>().unwrap_or_default();

    for (idx, val) in idx_data.iter().zip(val_data.iter()) {
        if *idx >= 0 && (*idx as usize) < result_data.len() {
            result_data[*idx as usize] = *val;
        }
    }

    Tensor::<B, 1, Int>::from_data(result_data.as_slice(), device)
}

pub fn get_iou<B: Backend>(gt_boxes: Tensor<B, 2>, dflt_boxes: Tensor<B, 2>) -> Tensor<B, 2> {
    let (gtx1, gty1, gtx2, gty2) = boxes_xyxy_to_components(gt_boxes);
    let (dfx1, dfy1, dfx2, dfy2) = boxes_xyxy_to_components(dflt_boxes);

    let dfx1_b = dfx1.clone().reshape([1, -1]);
    let x1_max = expand_and_max(gtx1.clone(), dfx1_b);
    let dfy1_b = dfy1.clone().reshape([1, -1]);
    let y1_max = expand_and_max(gty1.clone(), dfy1_b);
    let dfx2_b = dfx2.clone().reshape([1, -1]);
    let x2_min = expand_and_min(gtx2.clone(), dfx2_b);
    let dfy2_b = dfy2.clone().reshape([1, -1]);
    let y2_min = expand_and_min(gty2.clone(), dfy2_b);

    let area_dflt = (gtx2 - gtx1) * (gty2 - gty1);
    let area_gt = (dfx2 - dfx1) * (dfy2 - dfy1);
    let intersection_area = (x2_min - x1_max).clamp_min(0.0) * (y2_min - y1_max).clamp_min(0.0);

    let area_gt_b = area_gt.reshape([1, -1]);
    let area_dflt_b = area_dflt.reshape([-1, 1]);
    let union = area_dflt_b + area_gt_b - intersection_area.clone();

    intersection_area / union
}

fn expand_and_max<B: Backend>(a: Tensor<B, 1>, b: Tensor<B, 2>) -> Tensor<B, 2> {
    let a_b = a.reshape([-1, 1]);
    let rows = a_b.dims()[0];
    let cols = b.dims()[1];
    let a_exp = a_b.expand([rows, cols]);
    let b_exp = b.expand([rows, cols]);
    a_exp.max_pair(b_exp)
}

fn expand_and_min<B: Backend>(a: Tensor<B, 1>, b: Tensor<B, 2>) -> Tensor<B, 2> {
    let a_b = a.reshape([-1, 1]);
    let rows = a_b.dims()[0];
    let cols = b.dims()[1];
    let a_exp = a_b.expand([rows, cols]);
    let b_exp = b.expand([rows, cols]);
    a_exp.min_pair(b_exp)
}

pub fn get_overlapping_dflt_boxes<B: Backend>(
    gt_boxes: Tensor<B, 2>,
    dflt_bxs: Tensor<B, 2>,
    threshold: f32,
) -> Tensor<B, 1, Int> {
    let gt_bx_cnt = gt_boxes.dims()[0];
    let iou = get_iou(gt_boxes, dflt_bxs.clone());

    let (val, index) = iou.clone().max_dim_with_indices(0);
    let threshold_mask = val.lower_elem(threshold);
    let min_iou_thresh = index.mask_fill(threshold_mask, -1);

    let (_, max_iou_boxes) = iou.max_dim_with_indices(1);
    let max_iou_boxes_flat = max_iou_boxes.reshape([-1]);

    let mut best_matches: Vec<i32> = min_iou_thresh
        .into_data()
        .to_vec::<i32>()
        .unwrap_or_default();

    let max_iou_data: Vec<i32> = max_iou_boxes_flat
        .into_data()
        .to_vec::<i32>()
        .unwrap_or_default();

    for (i, &max_iou_val) in max_iou_data.iter().enumerate() {
        if i >= gt_bx_cnt {
            break;
        }
        if max_iou_val >= 0 && (max_iou_val as usize) < best_matches.len() {
            best_matches[max_iou_val as usize] = i as i32;
        }
    }

    Tensor::<B, 1, Int>::from_data(best_matches.as_slice(), &dflt_bxs.device())
}

pub fn generate_all_default_boxes<B: Backend>(feature_maps: &[Tensor<B, 4>; 6]) -> Tensor<B, 2> {
    let mut default_box_vec = Vec::new();
    let conv_list = SSDConvLayers::as_list();

    for (i, conv) in conv_list.iter().enumerate() {
        let width = feature_maps[i].dims()[3];
        let (cx_vec, cy_vec) = get_default_box_centers(width);
        let mut grid_pos: Vec<f32> = Vec::new();

        for cy in &cy_vec {
            for cx in &cx_vec {
                let default_boxes = get_default_boxes(conv);
                for (w, h) in default_boxes {
                    let xyxy = cxcywh_to_x1y1x2y2_f32(*cx, *cy, w, h);
                    grid_pos.extend_from_slice(&xyxy);
                }
            }
        }

        let boxes = Tensor::<B, 1>::from_floats(grid_pos.as_slice(), &feature_maps[0].device());
        let boxes = boxes.reshape([grid_pos.len() / 4, 4]);
        default_box_vec.push(boxes);
    }

    Tensor::cat(default_box_vec, 0)
}

pub fn box_regression<B: Backend>(
    g: Tensor<B, 2>,
    d: Tensor<B, 2>,
    (w1, w2, w3, w4): (f32, f32, f32, f32),
) -> Tensor<B, 2> {
    let g_cxcywh = xyxy_to_cxcywh(g);
    let d_cxcywh = xyxy_to_cxcywh(d);

    let n = g_cxcywh.dims()[0];
    let gx = g_cxcywh.clone().slice([0..n, 0..1]).reshape([-1]);
    let gy = g_cxcywh.clone().slice([0..n, 1..2]).reshape([-1]);
    let gw = g_cxcywh.clone().slice([0..n, 2..3]).reshape([-1]);
    let gh = g_cxcywh.slice([0..n, 3..4]).reshape([-1]);

    let px = d_cxcywh.clone().slice([0..n, 0..1]).reshape([-1]);
    let py = d_cxcywh.clone().slice([0..n, 1..2]).reshape([-1]);
    let pw = d_cxcywh.clone().slice([0..n, 2..3]).reshape([-1]);
    let ph = d_cxcywh.slice([0..n, 3..4]).reshape([-1]);

    let tx = ((gx - px.clone()) / pw.clone() * w1).reshape([-1, 1]);
    let ty = ((gy - py.clone()) / ph.clone() * w2).reshape([-1, 1]);
    let tw = ((gw.clone() / pw).log() * w3).reshape([-1, 1]);
    let th = ((gh / ph).log() * w4).reshape([-1, 1]);

    Tensor::cat(vec![tx, ty, tw, th], 1)
}

pub fn box_generation<B: Backend>(
    p: Tensor<B, 2>,
    d: Tensor<B, 2>,
    (w1, w2, w3, w4): (f32, f32, f32, f32),
) -> Tensor<B, 2> {
    let d_cxcywh = xyxy_to_cxcywh(d);
    let n = d_cxcywh.dims()[0];
    let center_x = d_cxcywh.clone().slice([0..n, 0..1]).reshape([-1]);
    let center_y = d_cxcywh.clone().slice([0..n, 1..2]).reshape([-1]);
    let w = d_cxcywh.clone().slice([0..n, 2..3]).reshape([-1]);
    let h = d_cxcywh.slice([0..n, 3..4]).reshape([-1]);

    let dx = (p.clone().slice([0..n, 0..1]).reshape([-1]) / w1).reshape([-1]);
    let dy = (p.clone().slice([0..n, 1..2]).reshape([-1]) / w2).reshape([-1]);
    let dw = (p.clone().slice([0..n, 2..3]).reshape([-1]) / w3).reshape([-1]);
    let dh = (p.slice([0..n, 3..4]).reshape([-1]) / w4).reshape([-1]);

    let pcx = (dx * w.clone() + center_x).reshape([-1, 1]);
    let pcy = (dy * h.clone() + center_y).reshape([-1, 1]);
    let pw = (dw.exp() * w).reshape([-1, 1]);
    let ph = (dh.exp() * h).reshape([-1, 1]);

    cxcywh_to_xyxy(Tensor::cat(vec![pcx, pcy, pw, ph], 1))
}

pub fn xyxy_nms(boxes: &[(f32, f32, f32, f32, f32, usize)], iou_threshold: f32) -> Vec<usize> {
    if boxes.is_empty() {
        return Vec::new();
    }

    let mut sorted: Vec<(usize, &(f32, f32, f32, f32, f32, usize))> =
        boxes.iter().enumerate().collect();
    sorted.sort_by(|a, b| b.1 .4.partial_cmp(&a.1 .4).unwrap());

    let mut keep = Vec::new();
    let mut suppressed = vec![false; boxes.len()];

    for (idx, &(i, box_i)) in sorted.iter().enumerate() {
        if suppressed[idx] {
            continue;
        }
        keep.push(i);

        for (jdx, &(_j, box_j)) in sorted.iter().enumerate().skip(idx + 1) {
            if suppressed[jdx] {
                continue;
            }
            let iou = compute_iou_xyxy(
                (box_i.0, box_i.1, box_i.2, box_i.3),
                (box_j.0, box_j.1, box_j.2, box_j.3),
            );
            if iou > iou_threshold {
                suppressed[jdx] = true;
            }
        }
    }

    keep
}

pub fn compute_iou_xyxy(a: (f32, f32, f32, f32), b: (f32, f32, f32, f32)) -> f32 {
    let x1 = a.0.max(b.0);
    let y1 = a.1.max(b.1);
    let x2 = a.2.min(b.2);
    let y2 = a.3.min(b.3);
    let inter = (x2 - x1).max(0.0) * (y2 - y1).max(0.0);
    let area_a = (a.2 - a.0) * (a.3 - a.1);
    let area_b = (b.2 - b.0) * (b.3 - b.1);
    let union = area_a + area_b - inter;
    if union <= 0.0 { 0.0 } else { inter / union }
}

fn sk(k: usize) -> f32 {
    let smin = 0.1;
    let smax = 0.9;
    smin + ((smax - smin) / (SSDConvLayers::count() as f32 - smin)) * (k - 1) as f32
}

fn ar(layer: &SSDConvLayers) -> Vec<f32> {
    match layer {
        SSDConvLayers::Conv4_3 => vec![1., 2., 1.0 / 2.0],
        SSDConvLayers::Conv7 => vec![1., 2., 3., 1.0 / 2.0, 1.0 / 3.0],
        SSDConvLayers::Conv8_2 => vec![1., 2., 3., 1.0 / 2.0, 1.0 / 3.0],
        SSDConvLayers::Conv9_2 => vec![1., 2., 3., 1.0 / 2.0, 1.0 / 3.0],
        SSDConvLayers::Conv10_2 => vec![1., 2., 1.0 / 2.0],
        SSDConvLayers::Conv11_2 => vec![1., 2., 1.0 / 2.0],
    }
}

fn wk(k: usize, ar: f32) -> f32 {
    sk(k) * f32::sqrt(ar)
}

fn hk(k: usize, ar: f32) -> f32 {
    sk(k) / f32::sqrt(ar)
}

fn ar1(k: usize) -> (f32, f32) {
    let s1 = f32::sqrt(sk(k) * sk(k + 1));
    (s1, s1)
}

fn get_default_box_centers(k: usize) -> (Vec<f32>, Vec<f32>) {
    (
        (0..k).map(|i| (i as f32 + 0.5) / k as f32).collect(),
        (0..k).map(|j| (j as f32 + 0.5) / k as f32).collect(),
    )
}

fn cxcywh_to_x1y1x2y2_f32(cx: f32, cy: f32, w: f32, h: f32) -> [f32; 4] {
    [cx - w * 0.5, cy - h * 0.5, cx + w * 0.5, cy + h * 0.5]
}

fn boxes_xyxy_to_components<B: Backend>(
    boxes: Tensor<B, 2>,
) -> (Tensor<B, 1>, Tensor<B, 1>, Tensor<B, 1>, Tensor<B, 1>) {
    let n = boxes.dims()[0];
    (
        boxes.clone().slice([0..n, 0..1]).reshape([-1]),
        boxes.clone().slice([0..n, 1..2]).reshape([-1]),
        boxes.clone().slice([0..n, 2..3]).reshape([-1]),
        boxes.slice([0..n, 3..4]).reshape([-1]),
    )
}

fn xyxy_to_cxcywh<B: Backend>(boxes: Tensor<B, 2>) -> Tensor<B, 2> {
    let (x1, y1, x2, y2) = boxes_xyxy_to_components(boxes);
    let w = x2.clone() - x1.clone();
    let h = y2.clone() - y1.clone();
    let cx = (x1 + w.clone() * 0.5).reshape([-1, 1]);
    let cy = (y1 + h.clone() * 0.5).reshape([-1, 1]);
    Tensor::cat(vec![cx, cy, w.reshape([-1, 1]), h.reshape([-1, 1])], 1)
}

fn cxcywh_to_xyxy<B: Backend>(boxes: Tensor<B, 2>) -> Tensor<B, 2> {
    let n = boxes.dims()[0];
    let cx = boxes.clone().slice([0..n, 0..1]).reshape([-1]);
    let cy = boxes.clone().slice([0..n, 1..2]).reshape([-1]);
    let w = boxes.clone().slice([0..n, 2..3]).reshape([-1]);
    let h = boxes.slice([0..n, 3..4]).reshape([-1]);
    Tensor::cat(
        vec![
            (cx.clone() - w.clone() * 0.5).reshape([-1, 1]),
            (cy.clone() - h.clone() * 0.5).reshape([-1, 1]),
            (cx + w * 0.5).reshape([-1, 1]),
            (cy + h * 0.5).reshape([-1, 1]),
        ],
        1,
    )
}
