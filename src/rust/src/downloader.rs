use js_sys::global;
use js_sys::{Promise, Uint8Array};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;
use web_sys::DedicatedWorkerGlobalScope;
use web_sys::{
    Event, IdbDatabase, IdbFactory, IdbOpenDbRequest, ReadableStreamDefaultReader, Request,
    RequestInit, RequestMode, Response,
};

#[wasm_bindgen(typescript_custom_section)]
const TS_APPEND_CONTENT: &'static str = r#"
export interface DownloadTask {
  on(event: 'begin', callback: (filename: string) => void): DownloadTask;
  on(event: 'progress', callback: (filename: string, bytesReceived: number, totalBytes?: number, percentage?: number) => void): DownloadTask;
  on(event: 'complete', callback: (filename: string) => void): DownloadTask;
}
"#;

#[wasm_bindgen]
pub struct DownloadTask {
    downloader: Downloader,
    filename: String,
    key: String,
}

#[wasm_bindgen]
impl DownloadTask {
    #[wasm_bindgen]
    pub fn on(&mut self, event: &str, callback: Option<js_sys::Function>) {
        if let Some(cb) = callback {
            match event {
                "begin" => self.downloader.begin_callback = Some(cb),
                "progress" => self.downloader.progress_callback = Some(cb),
                "complete" => self.downloader.complete_callback = Some(cb),
                _ => {}
            }
        }
    }

    pub async fn start(&self) -> Result<Uint8Array, JsValue> {
        let db = Downloader::open_db().await?;

        match self
            .downloader
            .fetch_file_with_callbacks(&self.filename)
            .await
        {
            Ok(content) => {
                let store_names: js_sys::Array = js_sys::Array::of1(&JsValue::from_str(STORE_NAME));
                let transaction = db.transaction_with_str_sequence_and_mode(
                    &store_names,
                    web_sys::IdbTransactionMode::Readwrite,
                )?;
                let store = transaction.object_store(STORE_NAME)?;
                store.put_with_key(&content, &JsValue::from_str(&self.key))?;

                Ok(content)
            }
            Err(e) => Err(e),
        }
    }
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(extends = js_sys::Function)]
    #[wasm_bindgen(typescript_type = "(filename: string) => void")]
    pub type BeginCallback;

    #[wasm_bindgen(extends = js_sys::Function)]
    #[wasm_bindgen(
        typescript_type = "(filename: string, bytesReceived: number, totalBytes?: number, percentage?: number) => void"
    )]
    pub type ProgressCallback;

    #[wasm_bindgen(extends = js_sys::Function)]
    #[wasm_bindgen(typescript_type = "(filename: string) => void")]
    pub type CompleteCallback;
}

const DB_NAME: &str = "model_store";
const STORE_NAME: &str = "models";
const DB_VERSION: u32 = 1;

#[wasm_bindgen]
pub struct Downloader {
    repository_url: String,

    begin_callback: Option<js_sys::Function>,
    progress_callback: Option<js_sys::Function>,
    complete_callback: Option<js_sys::Function>,
}

#[wasm_bindgen]
impl Downloader {
    #[wasm_bindgen(constructor)]
    pub fn new(repository_url: &str) -> Self {
        Self {
            repository_url: repository_url.to_string(),
            begin_callback: None,
            progress_callback: None,
            complete_callback: None,
        }
    }

    async fn open_db() -> Result<IdbDatabase, JsValue> {
        let window = global().dyn_into::<DedicatedWorkerGlobalScope>()?;
        let indexed_db: IdbFactory = window
            .indexed_db()?
            .ok_or(JsValue::from_str("IndexedDB not supported"))?;

        let open_request: IdbOpenDbRequest = indexed_db.open_with_u32(DB_NAME, DB_VERSION)?;

        let promise = Promise::new(&mut |resolve, reject| {
            let on_success = Closure::once(move |event: Event| {
                let db = event
                    .target()
                    .unwrap()
                    .dyn_into::<IdbOpenDbRequest>()
                    .unwrap()
                    .result()
                    .unwrap();
                resolve.call1(&JsValue::NULL, &db).unwrap();
            });

            let on_error = Closure::once(move |_: Event| {
                reject.call1(&JsValue::NULL, &JsValue::NULL).unwrap();
            });

            let on_upgrade_needed = Closure::once(move |event: Event| {
                let db = event
                    .target()
                    .unwrap()
                    .dyn_into::<IdbOpenDbRequest>()
                    .unwrap()
                    .result()
                    .unwrap()
                    .dyn_into::<IdbDatabase>()
                    .unwrap();

                db.create_object_store(STORE_NAME).unwrap();
            });

            open_request.set_onsuccess(Some(on_success.as_ref().unchecked_ref()));
            open_request.set_onerror(Some(on_error.as_ref().unchecked_ref()));
            open_request.set_onupgradeneeded(Some(on_upgrade_needed.as_ref().unchecked_ref()));

            on_success.forget();
            on_error.forget();
            on_upgrade_needed.forget();
        });

        let db: IdbDatabase = JsFuture::from(promise).await?.dyn_into()?;
        Ok(db)
    }

    pub fn save_file(&self, filename: &str, key: &str) -> DownloadTask {
        DownloadTask {
            downloader: Downloader {
                repository_url: self.repository_url.clone(),
                begin_callback: None,
                progress_callback: None,
                complete_callback: None,
            },
            filename: filename.to_string(),
            key: key.to_string(),
        }
    }

    async fn fetch_file_with_callbacks(&self, filename: &str) -> Result<Uint8Array, JsValue> {
        let url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            self.repository_url, filename
        );

        let opts = RequestInit::new();
        opts.set_method("GET");
        opts.set_mode(RequestMode::Cors);

        let request = Request::new_with_str_and_init(&url, &opts)?;
        let window = global().dyn_into::<DedicatedWorkerGlobalScope>()?;
        let resp_value = JsFuture::from(window.fetch_with_request(&request)).await?;
        let resp: Response = resp_value.dyn_into()?;

        if !resp.ok() {
            return Err(JsValue::from_str(&format!(
                "Failed to fetch {}: {}",
                filename,
                resp.status()
            )));
        }

        // Get content length for progress calculation (optional)
        let content_length = match resp.headers().get("content-length") {
            Ok(Some(value)) => value.parse::<f64>().ok(),
            _ => None,
        };

        // Send begin event
        if let Some(cb) = self.begin_callback.as_ref() {
            cb.call1(&JsValue::NULL, &JsValue::from_str(filename))?;
        }

        // Get the response body as a ReadableStream
        let body = match resp.body() {
            Some(b) => b,
            None => return Err(JsValue::from_str("No response body")),
        };

        let reader = match body.get_reader().dyn_into::<ReadableStreamDefaultReader>() {
            Ok(r) => r,
            Err(_) => return Err(JsValue::from_str("Failed to get reader")),
        };

        let mut received = 0.0;
        let mut chunks = Vec::new();

        loop {
            let result = JsFuture::from(reader.read()).await?;
            let done = js_sys::Reflect::get(&result, &JsValue::from_str("done"))?
                .as_bool()
                .unwrap();
            let value = js_sys::Reflect::get(&result, &JsValue::from_str("value"))?;

            if done {
                break;
            }

            if let Some(chunk) = value.dyn_ref::<Uint8Array>() {
                received += chunk.length() as f64;
                chunks.push(chunk.to_vec());

                // Send progress event
                if let Some(cb) = self.progress_callback.as_ref() {
                    if let Some(total) = content_length {
                        let percentage = (received / total * 100.0) as i32;
                        let args = js_sys::Array::new();
                        args.push(&JsValue::from_str(filename));
                        args.push(&JsValue::from_f64(received));
                        args.push(&JsValue::from_f64(total));
                        args.push(&JsValue::from(percentage));
                        cb.apply(&JsValue::NULL, &args)?;
                    } else {
                        // No total size, so call with 2 arguments
                        cb.call2(
                            &JsValue::NULL,
                            &JsValue::from_str(filename),
                            &JsValue::from_f64(received),
                        )?;
                    }
                }
            }
        }

        // Combine all chunks into one array
        let total_length = chunks.iter().map(|chunk| chunk.len()).sum();
        let mut combined = Vec::with_capacity(total_length);
        for chunk in chunks {
            combined.extend(chunk);
        }

        // Send complete event
        if let Some(cb) = self.complete_callback.as_ref() {
            cb.call1(&JsValue::NULL, &JsValue::from_str(filename))?;
        }

        Ok(Uint8Array::from(&combined[..]))
    }

    pub async fn model_exists() -> bool {
        Self::exists("model").await
    }

    pub async fn tokenizer_exists() -> bool {
        Self::exists("tokenizer").await
    }

    pub async fn config_exists() -> bool {
        Self::exists("config").await
    }

    async fn exists(key: &str) -> bool {
        let store_names: js_sys::Array = js_sys::Array::of1(&JsValue::from_str(STORE_NAME));

        let db = Self::open_db().await;

        if db.is_err() {
            return false;
        }

        let db = db.unwrap();

        let transaction = db.transaction_with_str_sequence_and_mode(
            &store_names,
            web_sys::IdbTransactionMode::Readonly,
        );

        if transaction.is_err() {
            return false;
        }

        let transaction = transaction.unwrap();

        let store = transaction.object_store(STORE_NAME);

        if store.is_err() {
            return false;
        }

        let store = store.unwrap();
        let request = store.get(&JsValue::from_str(key));

        if request.is_err() {
            return false;
        }

        let request = request.unwrap();

        let data = Self::idbrequest_to_result::<Uint8Array>(&request).await;
        data.is_ok()
    }

    pub async fn get(key: &str) -> Option<Uint8Array> {
        let store_names: js_sys::Array = js_sys::Array::of1(&JsValue::from_str(STORE_NAME));

        let db = Self::open_db().await;

        if db.is_err() {
            return None;
        }

        let db = db.unwrap();

        let transaction = db.transaction_with_str_sequence_and_mode(
            &store_names,
            web_sys::IdbTransactionMode::Readonly,
        );

        if transaction.is_err() {
            return None;
        }

        let transaction = transaction.unwrap();

        let store = transaction.object_store(STORE_NAME);

        if store.is_err() {
            return None;
        }

        let store = store.unwrap();
        let request = store.get(&JsValue::from_str(key));

        if request.is_err() {
            return None;
        }

        let request = request.unwrap();

        let data = Self::idbrequest_to_result::<Uint8Array>(&request).await;

        if data.is_err() {
            return None;
        }

        if let Ok(data) = data {
            Some(data)
        } else {
            None
        }
    }

    pub async fn remove(key: &str) -> bool {
        let store_names: js_sys::Array = js_sys::Array::of1(&JsValue::from_str(STORE_NAME));

        let db = Self::open_db().await;

        if db.is_err() {
            return false;
        }

        let db = db.unwrap();

        let transaction = db.transaction_with_str_sequence_and_mode(
            &store_names,
            web_sys::IdbTransactionMode::Readwrite,
        );

        if transaction.is_err() {
            return false;
        }

        let transaction = transaction.unwrap();

        let store = transaction.object_store(STORE_NAME);

        if store.is_err() {
            return false;
        }

        let store = store.unwrap();
        let request = store.delete(&JsValue::from_str(key));

        if request.is_err() {
            return false;
        }

        let request = request.unwrap();

        let result = Self::idbrequest_to_result::<JsValue>(&request).await;
        result.is_ok()
    }

    async fn idbrequest_to_result<T: JsCast>(request: &web_sys::IdbRequest) -> Result<T, JsValue> {
        let promise = Promise::new(&mut |resolve, reject| {
            let on_success = Closure::once(move |event: Event| {
                let target = event
                    .target()
                    .unwrap()
                    .dyn_into::<web_sys::IdbRequest>()
                    .unwrap();

                let result = target.result().unwrap();
                let result_js = result.as_ref();

                resolve.call1(&JsValue::NULL, result_js).unwrap();
            });

            let on_fail = Closure::once(move |event: Event| {
                let error = event
                    .target()
                    .unwrap()
                    .dyn_into::<web_sys::IdbRequest>()
                    .unwrap();
                let error_js: &JsValue = error.as_ref();

                reject.call1(&JsValue::NULL, error_js).unwrap();
            });

            request.set_onsuccess(Some(on_success.as_ref().unchecked_ref()));
            request.set_onerror(Some(on_fail.as_ref().unchecked_ref()));

            on_success.forget();
            on_fail.forget();
        });

        let data: T = JsFuture::from(promise).await?.dyn_into()?;
        Ok(data)
    }
}
