import path from "path";

import initWasm, { Downloader, Generator } from "@/models/pkg/gh_pages_rust";

const wasmLocalPath = new URL(
    "@/models/pkg/gh_pages_rust_bg.wasm",
    import.meta.url
).toString();

class Worker {
    private repository_name: string;
    private downloader: Downloader;
    private generator: Generator | undefined;
    private _isDownloading: boolean;
    private _isDownloaded: boolean;

    constructor(repository_name: string) {
        this.repository_name = repository_name;
        this.downloader = new Downloader(repository_name);
        this.generator = undefined;
        this._isDownloading = false;
        this._isDownloaded = false;
    }

    private get isDownloading() {
        return this._isDownloading;
    }

    private get isDownloaded() {
        return this._isDownloaded;
    }

    private setIsDownloading(value: boolean) {
        this._isDownloading = value;
        postMessage({ type: "set_isdownloading", value });
    }

    private setIsDownloaded(value: boolean) {
        this._isDownloaded = value;
        postMessage({ type: "set_isdownloaded", value });
    }

    public async clearCache() {
        const [modelRemoved, tokenizerRemoved] = await Promise.all([
            Downloader.remove("model"),
            Downloader.remove("tokenizer"),
        ]);

        this.setIsDownloaded(!(modelRemoved && tokenizerRemoved));
    }

    public async downloadRepository() {
        const localIsDownloaded = await this.checkDownloaded();

        if (this.isDownloading) {
            console.log("Currently downloading...");
            return;
        }

        if (this.isDownloaded || localIsDownloaded) {
            console.log("Already downloaded, skipping");
            return;
        }

        const modelDownload = this.downloader.save_file(
            "model.safetensors",
            "model"
        );

        const tokenDownload = this.downloader.save_file(
            "tokenizer.json",
            "tokenizer"
        );

        const configDownload = this.downloader.save_file(
            "config.json",
            "config"
        );

        this.setIsDownloading(true);

        const [model, tokenizer, config] = await Promise.all([
            modelDownload.start(),
            tokenDownload.start(),
            configDownload.start(),
        ]);

        modelDownload.on(
            "progress",
            (filename, bytesReceived, totalBytes, percentage) => {
                console.log(
                    `Downloading ${filename}: ${bytesReceived} / ${totalBytes} (${percentage}%)`
                );
            }
        );

        modelDownload.on("complete", (filename) => {
            console.log(`Download complete: ${filename}`);
        });

        await this.checkDownloaded();
        this.setIsDownloading(false);

        return [model, tokenizer, config];
    }

    public async checkDownloaded() {
        const exists = await Promise.all([
            Downloader.model_exists(),
            Downloader.tokenizer_exists(),
            Downloader.config_exists(),
        ]);

        const downloaded = exists.every((e) => e);

        this.setIsDownloaded(downloaded);

        return downloaded;
    }

    public async generateText(
        prompt: string,
        callback: (text: string) => void
    ) {
        const data = await this.downloadRepository();

        let model = data ? data[0] : undefined;
        let tokenizer = data ? data[1] : undefined;
        let config = data ? data[2] : undefined;

        if (model === undefined) {
            model = await Downloader.get("model");
        }

        if (tokenizer === undefined) {
            tokenizer = await Downloader.get("tokenizer");
        }

        if (config === undefined) {
            config = await Downloader.get("config");
        }

        if (!model || !tokenizer || !config) {
            console.log("Model, tokenizer, or config not found");
            return;
        }

        const generator = new Generator(model, tokenizer, config);

        console.log("Model loading done, begin generating...");

        const startTime = performance.now();
        generator.generate(prompt, callback);
        const endTime = performance.now();

        console.log(`Generation took ${endTime - startTime} ms`);
    }
}

const wasmFullPath = new URL(path.join(self.origin, wasmLocalPath));

initWasm(wasmFullPath).then(() => {
    const worker = new Worker("timinar/baby-llama-58m");

    self.onmessage = (event) => {
        (async () => {
            const { data } = event;
            const value = data.value;

            switch (data.type) {
                case "check_model":
                    {
                        const isDownloaded = await worker.checkDownloaded();
                        postMessage({
                            type: "model_checked",
                            value: isDownloaded,
                        });
                    }
                    break;

                case "load_data":
                    {
                        await worker.downloadRepository();
                        postMessage({ type: "data_loaded" });
                    }
                    break;

                case "generate_text":
                    {
                        await worker.generateText(value, (token) => {
                            postMessage({
                                type: "text_generated",
                                value: token,
                            });
                        });

                        postMessage({
                            type: "text_generate_done",
                        });
                    }
                    break;
            }
        })();
    };

    postMessage({ type: "worker_ready" });
});
