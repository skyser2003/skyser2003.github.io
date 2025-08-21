use gh_pages_rust::downloader::Downloader;
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
