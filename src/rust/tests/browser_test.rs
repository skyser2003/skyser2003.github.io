use gh_pages_rust::{downloader::Downloader, generator::Generator};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::wasm_bindgen_test;

wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
async fn test_wasm_api_download() -> Result<(), JsValue> {
    let downloader = Downloader::new("timinar/baby-llama-58m");
    downloader
        .save_file("model.safetensors", "model")
        .start()
        .await?;
    downloader
        .save_file("tokenizer.json", "tokenizer")
        .start()
        .await?;

    Ok(())
}

#[wasm_bindgen_test]
async fn test_generator() -> Result<(), JsValue> {
    let downloader = Downloader::new("timinar/baby-llama-58m");

    let model_weights = downloader
        .save_file("model.safetensors", "model")
        .start()
        .await?;

    let tokenizer = downloader
        .save_file("tokenizer.json", "tokenizer")
        .start()
        .await?;

    let mut generator = Generator::new(model_weights.to_vec(), tokenizer.to_vec())?;
    let output = generator.init_with_prompt("Once upon a time, ".to_string(), 1.0, 0.3, 0.5, 0)?;

    println!("{output}");

    Ok(())
}
