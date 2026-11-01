// signs every answer the chat route returns and checks the signatures when the conversation comes back.
// the browser keeps the history and sends it back whole (chat.tsx), so without this a client could write the
// assistant's earlier turns itself and steer the model with them: a forged assistant turn reads to the model like
// its own earlier speech, which carries more weight than anything in a user turn. the schema only checks that an
// assistant turn has a signature; this module checks that this server produced it for exactly that text.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import type { ChatMessage } from "./chat-types";
import { requireEnv } from "./env";

export const FORGED_HISTORY_ERROR = "The conversation history could not be verified.";

// the signing key is derived from the API key with HKDF (one-way, so it reveals nothing about the key): a separate
// secret without a second thing to configure, and the same after a restart, so an open conversation survives one.
// derived on first use, not at import, so the functions below can be tested with a key of their own.
let derivedKey: Buffer | undefined;
function signingKey(): Buffer {
    if (!derivedKey) {
        derivedKey = Buffer.from(hkdfSync("sha256", requireEnv("OPENROUTER_API_KEY"), "", "chat-signature", 32));
    }
    return derivedKey;
}

export function sign(content: string, key: Buffer | string = signingKey()): string {
    return createHmac("sha256", key).update(content).digest("base64url");
}

// constant-time comparison: a wrong signature takes as long to reject as a right one takes to accept
export function verify(content: string, signature: string, key: Buffer | string = signingKey()): boolean {
    const expected = Buffer.from(sign(content, key));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// true when every assistant turn carries the signature this server gave it
export function verifyHistory(messages: ChatMessage[], key: Buffer | string = signingKey()): boolean {
    return messages.every((m) => m.role !== "assistant" || verify(m.content, m.signature, key));
}
