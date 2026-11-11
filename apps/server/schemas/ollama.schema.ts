import { z } from "zod";

export const ollamaTagsSchema = z.object({
    models: z.array(
        z.object({
            name: z.string(),
        }),
    ),
});

export type OllamaTags = z.infer<typeof ollamaTagsSchema>;

export const ollamaChatResponseSchema = z.object({
    message: z.object({
        role: z.string(),
        content: z.string(),
    }),
});

export type OllamaChatResponse = z.infer<typeof ollamaChatResponseSchema>;

export const ollamaStreamChunkSchema = z
    .object({
        message: z.object({
            content: z.string(),
        }),
        done: z.boolean(),
    })
    .loose();

export type OllamaStreamChunk = z.infer<typeof ollamaStreamChunkSchema>;