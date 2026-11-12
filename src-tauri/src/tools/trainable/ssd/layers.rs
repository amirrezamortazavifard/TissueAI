#[repr(usize)]
#[derive(Debug, Clone, Copy)]
pub enum SSDConvLayers {
    Conv4_3,
    Conv7,
    Conv8_2,
    Conv9_2,
    Conv10_2,
    Conv11_2,
}

impl SSDConvLayers {
    pub fn as_list() -> Vec<SSDConvLayers> {
        vec![
            SSDConvLayers::Conv4_3,
            SSDConvLayers::Conv7,
            SSDConvLayers::Conv8_2,
            SSDConvLayers::Conv9_2,
            SSDConvLayers::Conv10_2,
            SSDConvLayers::Conv11_2,
        ]
    }

    pub fn count() -> usize {
        Self::as_list().len()
    }

    pub fn get_id(&self) -> usize {
        let val = match self {
            SSDConvLayers::Conv4_3 => 0,
            SSDConvLayers::Conv7 => 1,
            SSDConvLayers::Conv8_2 => 2,
            SSDConvLayers::Conv9_2 => 3,
            SSDConvLayers::Conv10_2 => 4,
            SSDConvLayers::Conv11_2 => 5,
        };
        val + 1
    }

    pub fn output_size(&self) -> usize {
        match self {
            SSDConvLayers::Conv4_3 => 512,
            SSDConvLayers::Conv7 => 1024,
            SSDConvLayers::Conv8_2 => 512,
            SSDConvLayers::Conv9_2 => 256,
            SSDConvLayers::Conv10_2 => 256,
            SSDConvLayers::Conv11_2 => 256,
        }
    }
}
