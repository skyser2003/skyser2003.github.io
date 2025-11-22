export enum WorkerSendMessageType {
    SetIsDownloading = "set_isdownloading",
    SetIsDownloaded = "set_isdownloaded",
    ModelChecked = "model_checked",
    DataLoaded = "data_loaded",
    TextGenerated = "text_generated",
    TextGenerateDone = "text_generate_done",
    RepositorySet = "repository_set",
    CacheCleared = "cache_cleared",
    WorkerReady = "worker_ready",
}

export enum WorkerReceiveMessageType {
    CheckModel = "check_model",
    LoadData = "load_data",
    GenerateText = "generate_text",
    SetRepository = "set_repository",
    ClearCache = "clear_cache",
}
