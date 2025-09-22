use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::{
    generation::{LogitsProcessor, Sampling},
    models::llama::{self as model, Config},
};

use model::{Llama, LlamaConfig};
use tokenizers::Tokenizer;
use wasm_bindgen::prelude::*;

const EOS_TOKEN: &str = "</s>";

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(extends = js_sys::Function)]
    #[wasm_bindgen(typescript_type = "(token: string) => void")]
    pub type GeneratorCallback;
}

#[wasm_bindgen(getter_with_clone)]
pub struct GenerationArguments {
    pub seed: u64,
    pub temperature: Option<f64>,
    pub top_k: Option<usize>,
    pub top_p: Option<f64>,
    pub sample_len: Option<usize>,
    pub repeat_penalty: Option<f32>,
    pub repeat_last_n: Option<usize>,
    pub no_kv_cache: bool,
}

pub struct GenerationArgumentsInternal {
    pub seed: u64,
    pub temperature: f64,
    pub top_k: Option<usize>,
    pub top_p: Option<f64>,
    pub sample_len: usize,
    pub repeat_penalty: f32,
    pub repeat_last_n: usize,
    pub no_kv_cache: bool,
}

// Provide a constructor so JS can create an Arguments object and then mutate fields.
#[wasm_bindgen]
impl GenerationArguments {
    #[wasm_bindgen(constructor)]
    pub fn new() -> GenerationArguments {
        GenerationArguments {
            seed: 42,
            temperature: Some(1.0),
            top_k: Some(40),
            top_p: None,
            sample_len: Some(128),
            repeat_penalty: Some(1.1),
            repeat_last_n: Some(64),
            no_kv_cache: false,
        }
    }
}

impl GenerationArguments {
    pub fn get_internal(&self) -> GenerationArgumentsInternal {
        GenerationArgumentsInternal {
            seed: self.seed,
            temperature: self.temperature.unwrap_or(1.0),
            top_k: self.top_k,
            top_p: self.top_p,
            sample_len: self.sample_len.unwrap_or(128),
            repeat_penalty: self.repeat_penalty.unwrap_or(1.0) as f32,
            repeat_last_n: self.repeat_last_n.unwrap_or(64),
            no_kv_cache: self.no_kv_cache,
        }
    }
}

#[wasm_bindgen]
pub struct Generator {
    model: Llama,
    tokenizer: Tokenizer,
    config: Config,
    dtype: DType,
    device: Device,
}

#[wasm_bindgen]
impl Generator {
    #[wasm_bindgen(constructor)]
    pub fn new(
        model_bytes: Vec<u8>,
        tokenizer_bytes: Vec<u8>,
        config_bytes: Vec<u8>,
        dtype: Option<String>,
    ) -> Self {
        let tokenizer = Tokenizer::from_bytes(tokenizer_bytes).unwrap();

        let config: LlamaConfig = serde_json::from_slice(&config_bytes).unwrap();
        let config = config.into_config(false);

        let device = Device::cuda_if_available(0).unwrap_or(Device::Cpu);
        let dtype = match dtype.as_deref() {
            Some("f16") => DType::F16,
            Some("bf16") => DType::BF16,
            Some("f32") => DType::F32,
            Some(dtype) => {
                println!("Error: wrong dtype {dtype}");

                DType::F16
            }
            None => DType::F16,
        };

        let vb = VarBuilder::from_buffered_safetensors(model_bytes, dtype, &device).unwrap();
        let model = Llama::load(vb, &config).unwrap();

        Self {
            model,
            tokenizer,
            config,
            dtype,
            device,
        }
    }

    pub fn generate(
        &self,
        input: &str,
        arguments: Option<GenerationArguments>,
        callback: Option<GeneratorCallback>,
    ) -> String {
        self.generate_inner(input, arguments, |output| {
            if let Some(callback) = &callback {
                callback
                    .call1(&JsValue::NULL, &JsValue::from_str(output))
                    .unwrap();
            }
        })
        .unwrap_or_default()
        .0
    }

    fn generate_inner(
        &self,
        input: &str,
        arguments: Option<GenerationArguments>,
        callback: impl Fn(&str),
    ) -> anyhow::Result<(String, i32)> {
        let args = arguments
            .unwrap_or_else(|| GenerationArguments::new())
            .get_internal();

        let mut tokenizer =
            crate::token_output_stream::TokenOutputStream::new(self.tokenizer.clone());

        let mut tokens = self
            .tokenizer
            .encode(input, true)
            .map_err(anyhow::Error::msg)?
            .get_ids()
            .to_vec();

        let mut cache =
            model::Cache::new(!args.no_kv_cache, self.dtype, &self.config, &self.device)?;

        let mut logits_processor = {
            let temperature = args.temperature;

            let sampling = if temperature <= 0. {
                Sampling::ArgMax
            } else {
                match (args.top_k, args.top_p) {
                    (None, None) => Sampling::All { temperature },
                    (Some(k), None) => Sampling::TopK { k, temperature },
                    (None, Some(p)) => Sampling::TopP { p, temperature },
                    (Some(k), Some(p)) => Sampling::TopKThenTopP { k, p, temperature },
                }
            };
            LogitsProcessor::from_sampling(args.seed, sampling)
        };

        let eos_token_id = self.config.eos_token_id.clone().or_else(|| {
            self.tokenizer
                .token_to_id(EOS_TOKEN)
                .map(model::LlamaEosToks::Single)
        });

        let mut index_pos = 0;
        let mut token_generated = 0;
        let mut all_generated = String::new();

        let sample_len = args.sample_len;
        let repeat_penalty = args.repeat_penalty;
        let repeat_last_n = args.repeat_last_n;

        for index in 0..sample_len {
            let (context_size, context_index) = if cache.use_kv_cache && index > 0 {
                (1, index_pos)
            } else {
                (tokens.len(), 0)
            };

            let ctxt = &tokens[tokens.len().saturating_sub(context_size)..];
            let input = Tensor::new(ctxt, &self.device)?.unsqueeze(0)?;
            let logits = self.model.forward(&input, context_index, &mut cache)?;
            let logits = logits.squeeze(0)?;
            let logits = if repeat_penalty == 1. {
                logits
            } else {
                let start_at = tokens.len().saturating_sub(repeat_last_n);
                candle_transformers::utils::apply_repeat_penalty(
                    &logits,
                    repeat_penalty,
                    &tokens[start_at..],
                )?
            };
            index_pos += ctxt.len();

            let next_token = logits_processor.sample(&logits)?;
            token_generated += 1;
            tokens.push(next_token);

            match eos_token_id {
                Some(model::LlamaEosToks::Single(eos_tok_id)) if next_token == eos_tok_id => {
                    break;
                }
                Some(model::LlamaEosToks::Multiple(ref eos_ids))
                    if eos_ids.contains(&next_token) =>
                {
                    break;
                }
                _ => (),
            }
            if let Some(t) = tokenizer.next_token(next_token)? {
                callback(&t);
                all_generated.push_str(&t);
            }
        }

        if let Some(rest) = tokenizer.decode_rest().map_err(anyhow::Error::msg)? {
            callback(&rest);
            all_generated.push_str(&rest);
        }

        Ok((all_generated, token_generated))
    }
}
