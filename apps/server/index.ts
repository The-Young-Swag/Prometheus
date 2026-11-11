import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamText } from "hono/streaming";
import { chatRequestSchema } from "./schemas/chat.schema";
import {
    generateOllamaResponse,
    generateOllamaStream,
    getOllamaModels,
} from "./services/ollama.service";
import { getRequiredModel } from "./utils/config";
import {
    createErrorResponse,
    respondWithError,
    respondWithValidationError,
} from "./utils/error";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => {
    return c.json({
        name: "Prometheus API",
        status: "OK",
        version: "0.1.0",
        endpoints: {
            health: "/health",
            modelHealth: "/health/model",
            chat: "/api/chat",
        },
    });
});

app.get("/health", (c) => {
    return c.json({ status: "OK" });
});

app.get("/health/model", async (c) => {
    try {
        const requiredModel = getRequiredModel();
        const models = await getOllamaModels();

        const modelAvailable = models.some(
            (model) => model.name === requiredModel,
        );

        if (!modelAvailable) {
            return c.json(
                createErrorResponse(
                    "Required model is not available",
                    503,
                    { model: requiredModel },
                ),
                503,
            );
        }

        return c.json({
            status: "OK",
            ollama: "connected",
            model: requiredModel,
            availableModels: models.map((model) => model.name),
        });
    } catch (error) {
        return respondWithError(c, error, 503);
    }
});

async function handleChatRequest(c: any, message: string, stream: boolean) {
    try {
        if (stream) {
            return streamText(c, async (streamWriter) => {
                const tokenStream = generateOllamaStream(
                    message,
                    c.req.raw.signal,
                );

                for await (const token of tokenStream) {
                    await streamWriter.write(token);
                }
            });
        }

        const reply = await generateOllamaResponse(message);

        return c.json({
            status: "OK",
            reply,
        });
    } catch (error) {
        return respondWithError(c, error, 502);
    }
}

app.get("/api/chat", async (c) => {
    const queryMessage = c.req.query("message");

    if (queryMessage) {
        const validation = chatRequestSchema.safeParse({ message: queryMessage });

        if (!validation.success) {
            return respondWithValidationError(c, validation.error.issues);
        }

        return handleChatRequest(c, validation.data.message, false);
    }

    return c.json({
        status: "OK",
        endpoint: "/api/chat",
        message: "Prometheus Chat API is active.",
        usage: {
            preferredMethod: "POST",
            body: {
                message: "Your message text here",
                stream: false,
            },
            browserQueryExample: "/api/chat?message=Hello+Prometheus",
        },
    });
});

app.post("/api/chat", async (c) => {
    try {
        const body: unknown = await c.req.json();

        const validation = chatRequestSchema.safeParse(body);

        if (!validation.success) {
            return respondWithValidationError(c, validation.error.issues);
        }

        return handleChatRequest(
            c,
            validation.data.message,
            validation.data.stream,
        );
    } catch (error) {
        return respondWithError(c, error, 502);
    }
});

export default app;