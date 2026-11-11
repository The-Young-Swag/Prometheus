import {
    ollamaChatResponseSchema,
    ollamaStreamChunkSchema,
    ollamaTagsSchema,
} from "../schemas/ollama.schema";

const OLLAMA_TAGS_TIMEOUT_MS = 5_000;
const OLLAMA_CHAT_TIMEOUT_MS = 120_000;

export async function getOllamaModels() {
    const baseUrl = process.env.OLLAMA_BASE_URL;

    if (!baseUrl) {
        throw new Error("OLLAMA_BASE_URL is not configured");
    }

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

export async function generateOllamaResponse(message: string) {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_MODEL;

    if (!baseUrl || !model) {
        throw new Error("Ollama configuration is incomplete");
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "user",
                    content: message,
                },
            ],
            stream: false,
        }),
        signal: AbortSignal.timeout(OLLAMA_CHAT_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
    }

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
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_MODEL;

    if (!baseUrl || !model) {
        throw new Error("Ollama configuration is incomplete");
    }

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
            stream: true,
        }),
        signal,
    });

    if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
    }

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

    // Flush any remaining bytes held by the decoder.
    buffer += decoder.decode();

    // Process the final event if it doesn't end with a newline.
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

