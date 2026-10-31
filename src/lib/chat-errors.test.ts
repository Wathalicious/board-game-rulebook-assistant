import { ChromaConnectionError } from "chromadb";
import { describe, expect, it } from "vitest";
import { toErrorResponse } from "./chat-errors";

// what the OpenAI client throws for a failed HTTP request: an Error with the response status on it
function providerError(status: number, message: string): Error {
    return Object.assign(new Error(message), { status });
}

describe("toErrorResponse", () => {
    it("Chroma unreachable → 503", () => {
        const response = toErrorResponse(new ChromaConnectionError("Failed to connect to chromadb at localhost:8000"));
        expect(response).toEqual({ status: 503, error: "The rulebook database is not reachable." });
    });

    it("rejected API key (401) → 502", () => {
        expect(toErrorResponse(providerError(401, "401 Missing Authentication header"))).toEqual({
            status: 502,
            error: "The language model rejected the server's API key.",
        });
    });

    it("rate limit (429) → 503", () => {
        expect(toErrorResponse(providerError(429, "429 Rate limit exceeded")).status).toBe(503);
    });

    it("any other provider status → 502", () => {
        expect(toErrorResponse(providerError(500, "500 Internal Server Error")).status).toBe(502);
        expect(toErrorResponse(providerError(404, "404 No endpoints found")).status).toBe(502);
    });

    it("anything else → 500", () => {
        expect(toErrorResponse(new Error("Connection error.")).status).toBe(500);
        expect(toErrorResponse(new TypeError("Cannot read properties of undefined")).status).toBe(500);
        expect(toErrorResponse("a thrown string").status).toBe(500);
        expect(toErrorResponse(undefined).status).toBe(500);
        // a status that is not a number is not a provider status
        expect(toErrorResponse(Object.assign(new Error("x"), { status: "401" })).status).toBe(500);
    });

    it("never passes the original error text to the client", () => {
        const secret = "sk-or-v1-abc123";
        const errors: unknown[] = [
            new ChromaConnectionError(`could not reach http://chroma.internal:8000 ${secret}`),
            providerError(401, `invalid key ${secret}`),
            providerError(503, `upstream failed ${secret}`),
            new Error(`stack trace with ${secret}`),
        ];
        for (const err of errors) {
            expect(toErrorResponse(err).error).not.toContain(secret);
        }
    });
});
