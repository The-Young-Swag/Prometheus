import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamText } from "hono/streaming";
import { chatRequestSchema } from "./schemas/chat.schema";
import {
    generateOllamaResponse,
    generateOllamaStream,
    getOllamaModels,
} from "./services/ollama.service";

const app = new Hono();

// Enable Cross-Origin Resource Sharing (CORS) for frontend clients
app.use("*", cors());

// Root API information
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

// Basic API health check
app.get("/health", (c) => {
    return c.json({ status: "OK" });
});

// Ollama connectivity and model availability check
app.get("/health/model", async (c) => {
    const requiredModel = process.env.OLLAMA_MODEL;

    if (!requiredModel) {
        return c.json(
            {
                status: "error",
                message: "OLLAMA_MODEL is not configured",
            },
            500,
        );
    }

    try {
        const models = await getOllamaModels();

        const modelAvailable = models.some(
            (model) => model.name === requiredModel,
        );

        if (!modelAvailable) {
            return c.json(
                {
                    status: "unavailable",
                    model: requiredModel,
                    message: "Required model is not available",
                },
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
        return c.json(
            {
                status: "unavailable",
                ollama: "disconnected",
                message:
                    error instanceof Error
                        ? error.message
                        : "An unexpected error occurred",
            },
            503,
        );
    }
});

// GET /api/chat - Informational endpoint & browser address-bar test query
app.get("/api/chat", async (c) => {
    const queryMessage = c.req.query("message");

    // Allow quick testing directly from browser address bar: /api/chat?message=hello
    if (queryMessage) {
        const validation = chatRequestSchema.safeParse({ message: queryMessage });

        if (!validation.success) {
            return c.json(
                {
                    status: "error",
                    message: "Invalid request",
                    errors: validation.error.issues,
                },
                400,
            );
        }

        try {
            const reply = await generateOllamaResponse(validation.data.message);
            return c.json({
                status: "OK",
                reply,
            });
        } catch (error) {
            return c.json(
                {
                    status: "error",
                    message:
                        error instanceof Error
                            ? error.message
                            : "An unexpected error occurred",
                },
                502,
            );
        }
    }

    // Default friendly response when visiting /api/chat directly in a browser
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

// POST /api/chat - Primary conversational chat endpoint (buffered & streaming)
app.post("/api/chat", async (c) => {
    try {
        const body: unknown = await c.req.json();

        const validation = chatRequestSchema.safeParse(body);

        if (!validation.success) {
            return c.json(
                {
                    status: "error",
                    message: "Invalid request",
                    errors: validation.error.issues,
                },
                400,
            );
        }

        // Stream tokens via chunked transfer encoding when requested
        if (validation.data.stream) {
            return streamText(c, async (stream) => {
                const tokenStream = generateOllamaStream(
                    validation.data.message,
                    c.req.raw.signal,
                );

                for await (const token of tokenStream) {
                    await stream.write(token);
                }
            });
        }

        // Buffered single-payload response
        const reply = await generateOllamaResponse(
            validation.data.message,
        );

        return c.json({
            status: "OK",
            reply,
        });
    } catch (error) {
        return c.json(
            {
                status: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "An unexpected error occurred",
            },
            502,
        );
    }
});

export default app;
