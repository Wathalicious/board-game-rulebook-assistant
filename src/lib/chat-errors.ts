// maps an error from the chat route to an HTTP status and a short message for the UI (never the stack or the raw message)
import { ChromaConnectionError } from "chromadb";

export type ErrorResponse = { status: number; error: string };

export function toErrorResponse(err: unknown): ErrorResponse {
    if (err instanceof ChromaConnectionError) {
        return { status: 503, error: "The rulebook database is not reachable." };
    }
    // errors from the model provider carry the HTTP status of its response
    const status = typeof err === "object" && err !== null && "status" in err ? err.status : undefined;
    if (status === 401) return { status: 502, error: "The language model rejected the server's API key." };
    if (status === 429) return { status: 503, error: "The language model is busy right now." };
    if (typeof status === "number") return { status: 502, error: "The language model could not be reached." };
    return { status: 500, error: "Something went wrong while answering." };
}