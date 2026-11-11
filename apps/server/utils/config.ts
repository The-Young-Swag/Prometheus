interface OllamaConfig {
    baseUrl: string;
    model: string;
}

export function getOllamaConfig(): OllamaConfig {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_MODEL;

    if (!baseUrl || !model) {
        throw new Error("Ollama configuration is incomplete");
    }

    return { baseUrl, model };
}

export function getRequiredModel(): string {
    const model = process.env.OLLAMA_MODEL;

    if (!model) {
        throw new Error("OLLAMA_MODEL is not configured");
    }

    return model;
}