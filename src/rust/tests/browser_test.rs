use wasm_bindgen::JsValue;
use wasm_bindgen_test::wasm_bindgen_test;

wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
async fn test_wasm_api_download() -> Result<(), JsValue> {
    use gh_pages_rust::downloader::Downloader;

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
    use gh_pages_rust::generator::GeneratorCallback;
    use gh_pages_rust::{downloader::Downloader, generator::Generator};

    let downloader = Downloader::new("timinar/baby-llama-58m");

    let model = downloader
        .save_file("model.safetensors", "model")
        .start()
        .await?;

    let tokenizer = downloader
        .save_file("tokenizer.json", "tokenizer")
        .start()
        .await?;

    let config = downloader
        .save_file("config.json", "config")
        .start()
        .await?;

    let generator = Generator::new(model.to_vec(), tokenizer.to_vec(), config.to_vec(), None);
    let output = generator.generate("Once upon a time, ", None); // TODO: proper callback

    println!("{output}");

    Ok(())
}
