import { z } from "zod";

export const chatRequestSchema = z.object({
    message: z.string().trim().min(1, "Message cannot be empty"),
    stream: z.boolean().optional().default(false),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
