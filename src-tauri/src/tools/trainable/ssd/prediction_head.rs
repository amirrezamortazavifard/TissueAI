use burn::module::Module;
use burn::nn;
use burn::nn::PaddingConfig2d;
use burn::tensor::backend::Backend;

use super::boxes::get_box_count_for_layer;
use super::layers::SSDConvLayers;

#[derive(Module, Debug)]
pub struct SSDPredictionHead<B: Backend> {
    pub(crate) conv_classifier: nn::conv::Conv2d<B>,
    pub(crate) conv_bbox: nn::conv::Conv2d<B>,
}

impl<B: Backend> SSDPredictionHead<B> {
    pub fn new(device: &B::Device, layer: &SSDConvLayers, cls_cnt: usize) -> Self {
        SSDPredictionHead {
            conv_classifier: nn::conv::Conv2dConfig::new(
                [layer.output_size(), cls_cnt * get_box_count_for_layer(layer)],
                [3, 3],
            )
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device),
            conv_bbox: nn::conv::Conv2dConfig::new(
                [layer.output_size(), 4 * get_box_count_for_layer(layer)],
                [3, 3],
            )
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device),
        }
    }
}
