use candle_transformers::models::quantized_llama::ModelWeights;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Model {
    weights: ModelWeights,
}

impl Model {
    pub fn new(weights: ModelWeights) -> Self {
        Self { weights }
    }
}

#[wasm_bindgen]
impl Model {
    pub fn inference(initial_input: String, callback: js_sys::Function) -> bool {
        true
    }
}
