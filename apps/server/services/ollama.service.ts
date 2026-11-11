import {
    ollamaChatResponseSchema,
    ollamaStreamChunkSchema,
    ollamaTagsSchema,
} from "../schemas/ollama.schema";
import { getOllamaConfig } from "../utils/config";

const OLLAMA_TAGS_TIMEOUT_MS = 5_000;
const OLLAMA_CHAT_TIMEOUT_MS = 120_000;

async function fetchOllamaTags(baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(OLLAMA_TAGS_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const json: unknown = await response.json();
    const result = ollamaTagsSchema.safeParse(json);

    if (!result.success) {
        throw new Error("Invalid Ollama API response");
    }

    return result.data.models;
}

export async function getOllamaModels() {
    const { baseUrl } = getOllamaConfig();
    return fetchOllamaTags(baseUrl);
}

interface OllamaChatOptions {
    message: string;
    stream: boolean;
    clientSignal?: AbortSignal;
}

async function fetchOllamaChat(
    baseUrl: string,
    model: string,
    options: OllamaChatOptions,
) {
    const { message, stream, clientSignal } = options;

    const timeoutSignal = AbortSignal.timeout(OLLAMA_CHAT_TIMEOUT_MS);
    const signal = clientSignal
        ? AbortSignal.any([clientSignal, timeoutSignal])
        : timeoutSignal;

    const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: message }],
            stream,
        }),
        signal,
    });

    if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    return response;
}

export async function generateOllamaResponse(message: string) {
    const { baseUrl, model } = getOllamaConfig();

    const response = await fetchOllamaChat(baseUrl, model, {
        message,
        stream: false,
    });

    const json: unknown = await response.json();
    const result = ollamaChatResponseSchema.safeParse(json);

    if (!result.success) {
        throw new Error("Invalid Ollama chat response");
    }

    return result.data.message.content;
}

export async function* generateOllamaStream(
    message: string,
    clientSignal?: AbortSignal,
): AsyncGenerator<string> {
    const { baseUrl, model } = getOllamaConfig();

    const response = await fetchOllamaChat(baseUrl, model, {
        message,
        stream: true,
        clientSignal,
    });

    if (!response.body) {
        throw new Error("Ollama returned an empty response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            if (!line.trim()) continue;

            const json: unknown = JSON.parse(line);
            const result = ollamaStreamChunkSchema.safeParse(json);

            if (!result.success) {
                throw new Error("Invalid Ollama streaming response");
            }

            const event = result.data;

            if (event.message.content) {
                yield event.message.content;
            }

            if (event.done) {
                return;
            }
        }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
        const json: unknown = JSON.parse(buffer);
        const result = ollamaStreamChunkSchema.safeParse(json);

        if (!result.success) {
            throw new Error("Invalid Ollama streaming response");
        }

        if (result.data.message.content) {
            yield result.data.message.content;
        }
    }
}