import type { z } from "zod";
import {
    ollamaChatResponseSchema,
    ollamaStreamChunkSchema,
    ollamaTagsSchema,
    type OllamaStreamChunk,
    type OllamaTags,
} from "../schemas/ollama.schema";
import { getOllamaConfig } from "../utils/config";

const OLLAMA_TAGS_TIMEOUT_MS = 5_000;
const OLLAMA_CHAT_TIMEOUT_MS = 120_000;

function assertOk(response: Response): void {
    if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
    }
}

function parseWithSchema<T>(
    json: unknown,
    schema: z.ZodType<T>,
    errorMessage: string,
): T {
    const result = schema.safeParse(json);

    if (!result.success) {
        throw new Error(errorMessage);
    }

    return result.data;
}

function parseStreamLine(line: string): OllamaStreamChunk {
    const json: unknown = JSON.parse(line);

    return parseWithSchema(
        json,
        ollamaStreamChunkSchema,
        "Invalid Ollama streaming response",
    );
}

async function fetchOllamaTags(
    baseUrl: string,
): Promise<OllamaTags["models"]> {
    const response = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(OLLAMA_TAGS_TIMEOUT_MS),
    });

    assertOk(response);

    const json: unknown = await response.json();
    const tags = parseWithSchema(
        json,
        ollamaTagsSchema,
        "Invalid Ollama API response",
    );

    return tags.models;
}

export async function getOllamaModels(): Promise<OllamaTags["models"]> {
    const { baseUrl } = getOllamaConfig();

    return fetchOllamaTags(baseUrl);
}

export function isOllamaModelAvailable(
    models: OllamaTags["models"],
    modelName: string,
): boolean {
    return models.some((model) => model.name === modelName);
}

interface OllamaChatOptions {
    message: string;
    stream: boolean;
    clientSignal?: AbortSignal;
}

function buildChatSignal(clientSignal?: AbortSignal): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(OLLAMA_CHAT_TIMEOUT_MS);

    return clientSignal
        ? AbortSignal.any([clientSignal, timeoutSignal])
        : timeoutSignal;
}

async function fetchOllamaChat(
    baseUrl: string,
    model: string,
    options: OllamaChatOptions,
): Promise<Response> {
    const { message, stream, clientSignal } = options;

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
        signal: buildChatSignal(clientSignal),
    });

    assertOk(response);

    return response;
}

export async function generateOllamaResponse(
    message: string,
): Promise<string> {
    const { baseUrl, model } = getOllamaConfig();

    const response = await fetchOllamaChat(baseUrl, model, {
        message,
        stream: false,
    });

    const json: unknown = await response.json();
    const chat = parseWithSchema(
        json,
        ollamaChatResponseSchema,
        "Invalid Ollama chat response",
    );

    return chat.message.content;
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
    let receivedDoneEvent = false;

    for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            if (!line.trim()) continue;

            const event = parseStreamLine(line);

            if (event.message.content) {
                yield event.message.content;
            }

            if (event.done) {
                receivedDoneEvent = true;
                return;
            }
        }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
        const event = parseStreamLine(buffer);

        if (event.message.content) {
            yield event.message.content;
        }

        if (event.done) {
            receivedDoneEvent = true;
        }
    }

    if (!receivedDoneEvent) {
        throw new Error("Ollama stream ended before completion");
    }
}
