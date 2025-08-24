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

#[wasm_bindgen(getter_with_clone)]
pub struct Arguments {
    pub temperature: f64,
    pub top_k: Option<usize>,
    pub top_p: Option<f64>,
    pub seed: u64,
    pub sample_len: usize,
    pub repeat_penalty: f32,
    pub repeat_last_n: usize,
    pub no_kv_cache: bool,
    pub dtype: String,
}

#[wasm_bindgen]
pub struct Generator {
    model: Llama,
    tokenizer: Tokenizer,
    arguments: Arguments,
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
        arguments: Option<Arguments>,
    ) -> Self {
        let arguments = arguments.unwrap_or(Arguments {
            temperature: 1.0,
            top_k: Some(40),
            top_p: None,
            seed: 42,
            sample_len: 128,
            repeat_penalty: 1.1,
            repeat_last_n: 64,
            no_kv_cache: false,
            dtype: "".to_string(),
        });

        let tokenizer = Tokenizer::from_bytes(tokenizer_bytes).unwrap();

        let config: LlamaConfig = serde_json::from_slice(&config_bytes).unwrap();
        let config = config.into_config(false);

        let device = Device::cuda_if_available(0).unwrap_or(Device::Cpu);
        let dtype = match arguments.dtype.as_str() {
            "f16" => DType::F16,
            "bf16" => DType::BF16,
            "f32" => DType::F32,
            dtype => {
                println!("Error: wrong dtype {dtype}");

                DType::F16
            }
        };

        let vb = VarBuilder::from_buffered_safetensors(model_bytes, dtype, &device).unwrap();
        let model = Llama::load(vb, &config).unwrap();

        Self {
            model,
            tokenizer,
            arguments,
            config,
            dtype,
            device,
        }
    }

    pub fn generate(&self, input: &str) -> String {
        self.generate_inner(input).unwrap_or_default().0
    }

    fn generate_inner(&self, input: &str) -> anyhow::Result<(String, i32)> {
        let args = &self.arguments;

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

        for index in 0..args.sample_len {
            let (context_size, context_index) = if cache.use_kv_cache && index > 0 {
                (1, index_pos)
            } else {
                (tokens.len(), 0)
            };

            let ctxt = &tokens[tokens.len().saturating_sub(context_size)..];
            let input = Tensor::new(ctxt, &self.device)?.unsqueeze(0)?;
            let logits = self.model.forward(&input, context_index, &mut cache)?;
            let logits = logits.squeeze(0)?;
            let logits = if args.repeat_penalty == 1. {
                logits
            } else {
                let start_at = tokens.len().saturating_sub(args.repeat_last_n);
                candle_transformers::utils::apply_repeat_penalty(
                    &logits,
                    args.repeat_penalty,
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
                all_generated.push_str(&t);
            }
        }

        if let Some(rest) = tokenizer.decode_rest().map_err(anyhow::Error::msg)? {
            all_generated.push_str(&rest);
        }

        Ok((all_generated, token_generated))
    }
}
