// zod schema for the POST /api/chat body
import { z } from "zod";

export const MAX_MESSAGES = 40;
export const MAX_CONTENT_LENGTH = 2000;

const content = z.string().trim().min(1, "message must not be empty").max(MAX_CONTENT_LENGTH, "message is too long");

// one shape per role: an assistant turn must carry the signature the server gave the answer. whether the signature
// is right is checked in the route (src/lib/chat-signature.ts); this file stays free of secrets and services
const messageSchema = z.discriminatedUnion("role", [
    z.strictObject({ role: z.literal("user"), content }),
    z.strictObject({ role: z.literal("assistant"), content, signature: z.string().min(1, "assistant messages need a signature") }),
]);

export const chatRequestSchema = z.strictObject({
    messages: z
        .array(messageSchema)
        .min(1, "messages must not be empty")
        .max(MAX_MESSAGES, "too many messages")
        .refine((messages) => messages.at(-1)?.role === "user", "the last message must come from the user"),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
