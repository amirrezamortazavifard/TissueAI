use burn::module::Module;
use burn::nn::PaddingConfig2d;
use burn::nn::conv::{Conv2d, Conv2dConfig};
use burn::nn::pool::{MaxPool2d, MaxPool2dConfig};
use burn::tensor::{Tensor, backend::Backend};

#[derive(Module, Debug)]
pub struct VGG16<B: Backend> {
    conv1_1: Conv2d<B>,
    conv1_2: Conv2d<B>,
    maxpool1: MaxPool2d,
    conv2_1: Conv2d<B>,
    conv2_2: Conv2d<B>,
    maxpool2: MaxPool2d,
    conv3_1: Conv2d<B>,
    conv3_2: Conv2d<B>,
    conv3_3: Conv2d<B>,
    maxpool3: MaxPool2d,
    conv4_1: Conv2d<B>,
    conv4_2: Conv2d<B>,
    conv4_3: Conv2d<B>,
    pub maxpool4: MaxPool2d,
    conv5_1: Conv2d<B>,
    conv5_2: Conv2d<B>,
    conv5_3: Conv2d<B>,
}

impl<B: Backend> VGG16<B> {
    pub fn new(device: &B::Device) -> Self {
        let conv1_1 = Conv2dConfig::new([3, 64], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let conv1_2 = Conv2dConfig::new([64, 64], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let maxpool1 = MaxPool2dConfig::new([2, 2]).with_strides([2, 2]).init();

        let conv2_1 = Conv2dConfig::new([64, 128], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let conv2_2 = Conv2dConfig::new([128, 128], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let maxpool2 = MaxPool2dConfig::new([2, 2]).with_strides([2, 2]).init();

        let conv3_1 = Conv2dConfig::new([128, 256], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let conv3_2 = Conv2dConfig::new([256, 256], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let conv3_3 = Conv2dConfig::new([256, 256], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let maxpool3 = MaxPool2dConfig::new([2, 2]).with_strides([2, 2]).init();

        let conv4_1 = Conv2dConfig::new([256, 512], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let conv4_2 = Conv2dConfig::new([512, 512], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let conv4_3 = Conv2dConfig::new([512, 512], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(2, 2, 2, 2))
            .init::<B>(device);
        let maxpool4 = MaxPool2dConfig::new([2, 2]).with_strides([2, 2]).init();

        let conv5_1 = Conv2dConfig::new([512, 512], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let conv5_2 = Conv2dConfig::new([512, 512], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);
        let conv5_3 = Conv2dConfig::new([512, 512], [3, 3])
            .with_padding(PaddingConfig2d::Explicit(1, 1, 1, 1))
            .init::<B>(device);

        Self {
            conv1_1, conv1_2, maxpool1,
            conv2_1, conv2_2, maxpool2,
            conv3_1, conv3_2, conv3_3, maxpool3,
            conv4_1, conv4_2, conv4_3, maxpool4,
            conv5_1, conv5_2, conv5_3,
        }
    }

    pub fn partial_forward(&self, input: Tensor<B, 4>) -> (Tensor<B, 4>, Tensor<B, 4>) {
        let x = burn::tensor::activation::relu(self.conv1_1.forward(input));
        let x = burn::tensor::activation::relu(self.conv1_2.forward(x));
        let x = self.maxpool1.forward(x);

        let x = burn::tensor::activation::relu(self.conv2_1.forward(x));
        let x = burn::tensor::activation::relu(self.conv2_2.forward(x));
        let x = self.maxpool2.forward(x);

        let x = burn::tensor::activation::relu(self.conv3_1.forward(x));
        let x = burn::tensor::activation::relu(self.conv3_2.forward(x));
        let x = burn::tensor::activation::relu(self.conv3_3.forward(x));
        let x = self.maxpool3.forward(x);

        let conv4_3_out = burn::tensor::activation::relu(self.conv4_1.forward(x));
        let conv4_3_out = burn::tensor::activation::relu(self.conv4_2.forward(conv4_3_out));
        let conv4_3_out = burn::tensor::activation::relu(self.conv4_3.forward(conv4_3_out));

        let x = self.maxpool4.forward(conv4_3_out.clone());

        let x = burn::tensor::activation::relu(self.conv5_1.forward(x));
        let x = burn::tensor::activation::relu(self.conv5_2.forward(x));
        let conv5_3_out = burn::tensor::activation::relu(self.conv5_3.forward(x));

        (conv4_3_out, conv5_3_out)
    }
}
