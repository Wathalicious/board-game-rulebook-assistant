// zod schema for the POST /api/chat body
import { z } from "zod";

export const MAX_MESSAGES = 40;
export const MAX_CONTENT_LENGTH = 2000;

const messageSchema = z.strictObject({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1, "message must not be empty").max(MAX_CONTENT_LENGTH, "message is too long"),
});

export const chatRequestSchema = z.strictObject({
    messages: z
        .array(messageSchema)
        .min(1, "messages must not be empty")
        .max(MAX_MESSAGES, "too many messages")
        .refine((messages) => messages.at(-1)?.role === "user", "the last message must come from the user"),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;