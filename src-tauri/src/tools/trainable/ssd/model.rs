use burn::module::Module;
use burn::nn;
use burn::nn::PaddingConfig2d;
use burn::tensor::{Tensor, backend::Backend};

use super::layers::SSDConvLayers;
use super::vgg::VGG16;
use super::prediction_head::SSDPredictionHead;

#[derive(Module, Debug)]
pub struct SSD<B: Backend> {
    pub vgg16: VGG16<B>,
    conv_6: nn::conv::Conv2d<B>,
    conv_7: nn::conv::Conv2d<B>,
    conv8_1: nn::conv::Conv2d<B>,
    conv8_2: nn::conv::Conv2d<B>,
    conv9_1: nn::conv::Conv2d<B>,
    conv9_2: nn::conv::Conv2d<B>,
    conv10_1: nn::conv::Conv2d<B>,
    conv10_2: nn::conv::Conv2d<B>,
    conv11_1: nn::conv::Conv2d<B>,
    conv11_2: nn::conv::Conv2d<B>,
    pub ssd_pred_heads: Vec<SSDPredictionHead<B>>,
    cls_cnt: usize,
}

impl<B: Backend> SSD<B> {
    pub fn new(device: &B::Device, cls_cnt: usize) -> Self {
        let mut vgg_mod = VGG16::new(device);

        vgg_mod.maxpool4 = nn::pool::MaxPool2dConfig::new([3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .with_dilation([2, 2])
            .init();

        let conv_6 = nn::conv::Conv2dConfig::new([512, 1024], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);

        let conv_7 = nn::conv::Conv2dConfig::new([1024, 1024], [1, 1])
            .init::<B>(device);

        let conv8_1 = nn::conv::Conv2dConfig::new([1024, 256], [1, 1])
            .init::<B>(device);
        let conv8_2 = nn::conv::Conv2dConfig::new([256, 512], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .with_stride([2, 2])
            .init::<B>(device);

        let conv9_1 = nn::conv::Conv2dConfig::new([512, 128], [1, 1])
            .init::<B>(device);
        let conv9_2 = nn::conv::Conv2dConfig::new([128, 256], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .with_stride([2, 2])
            .init::<B>(device);

        let conv10_1 = nn::conv::Conv2dConfig::new([256, 128], [1, 1])
            .init::<B>(device);
        let conv10_2 = nn::conv::Conv2dConfig::new([128, 256], [3, 3])
            .with_stride([1, 1])
            .init::<B>(device);

        let conv11_1 = nn::conv::Conv2dConfig::new([256, 128], [1, 1])
            .init::<B>(device);
        let conv11_2 = nn::conv::Conv2dConfig::new([128, 256], [3, 3])
            .with_stride([1, 1])
            .init::<B>(device);

        let mut ssd_pred_heads = Vec::new();
        for conv_layer in SSDConvLayers::as_list().iter() {
            ssd_pred_heads.push(SSDPredictionHead::new(device, conv_layer, cls_cnt));
        }

        SSD {
            vgg16: vgg_mod,
            conv_6,
            conv_7,
            conv8_1,
            conv8_2,
            conv9_1,
            conv9_2,
            conv10_1,
            conv10_2,
            conv11_1,
            conv11_2,
            ssd_pred_heads,
            cls_cnt,
        }
    }

    pub fn forward(&self, input: Tensor<B, 4>) -> (Tensor<B, 3>, Tensor<B, 3>, [Tensor<B, 4>; 6]) {
        let (conv_4_3_out, conv_5_3_out) = self.vgg16.partial_forward(input);

        let conv_6_out = self.conv_6.forward(conv_5_3_out);
        let relu_6_out = burn::tensor::activation::relu(conv_6_out);
        let conv_7_out = self.conv_7.forward(relu_6_out);
        let conv_7_out = burn::tensor::activation::relu(conv_7_out);

        let conv_8_1_out = self.conv8_1.forward(conv_7_out.clone());
        let relu_8_1_out = burn::tensor::activation::relu(conv_8_1_out);
        let conv_8_2_out = self.conv8_2.forward(relu_8_1_out);
        let conv_8_2_out = burn::tensor::activation::relu(conv_8_2_out);

        let conv_9_1_out = self.conv9_1.forward(conv_8_2_out.clone());
        let relu_9_1_out = burn::tensor::activation::relu(conv_9_1_out);
        let conv_9_2_out = self.conv9_2.forward(relu_9_1_out);
        let conv_9_2_out = burn::tensor::activation::relu(conv_9_2_out);

        let conv_10_1_out = self.conv10_1.forward(conv_9_2_out.clone());
        let relu_10_1_out = burn::tensor::activation::relu(conv_10_1_out);
        let conv_10_2_out = self.conv10_2.forward(relu_10_1_out);
        let conv_10_2_out = burn::tensor::activation::relu(conv_10_2_out);

        let conv_11_1_out = self.conv11_1.forward(conv_10_2_out.clone());
        let relu_11_1_out = burn::tensor::activation::relu(conv_11_1_out);
        let conv_11_2_out = self.conv11_2.forward(relu_11_1_out);
        let conv_11_2_out = burn::tensor::activation::relu(conv_11_2_out);

        let outputs = [
            conv_4_3_out,
            conv_7_out,
            conv_8_2_out,
            conv_9_2_out,
            conv_10_2_out,
            conv_11_2_out,
        ];

        let mut class_predictors = Vec::new();
        let mut box_predictors = Vec::new();

        for (i, conv_out) in outputs.iter().enumerate() {
            let box_pred = self.ssd_pred_heads[i].conv_bbox.forward(conv_out.clone());
            let class_pred = self.ssd_pred_heads[i].conv_classifier.forward(conv_out.clone());

            let batch_size = class_pred.dims()[0];
            let height = class_pred.dims()[2];
            let width = class_pred.dims()[3];

            let class_pred = class_pred.reshape([
                batch_size as i32,
                -1,
                self.cls_cnt as i32,
                height as i32,
                width as i32,
            ]);
            let class_pred = class_pred.permute([0, 3, 4, 1, 2]);
            let class_pred = class_pred.reshape([batch_size as i32, -1, self.cls_cnt as i32]);
            class_predictors.push(class_pred);

            let box_pred = box_pred.reshape([
                batch_size as i32,
                -1,
                4,
                height as i32,
                width as i32,
            ]);
            let box_pred = box_pred.permute([0, 3, 4, 1, 2]);
            let box_pred = box_pred.reshape([batch_size as i32, -1, 4]);
            box_predictors.push(box_pred);
        }

        let class_predictors = Tensor::cat(class_predictors, 1);
        let box_predictions = Tensor::cat(box_predictors, 1);

        (class_predictors, box_predictions, outputs)
    }
}
