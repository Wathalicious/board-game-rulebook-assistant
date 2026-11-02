// the chat route streams its answer as newline-delimited JSON: one StreamEvent (chat-types.ts) per line.
// shared by the route (encode) and the browser (read), so it imports nothing from langchain or node
import type { StreamEvent } from "./chat-types";

export const STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

export function encodeEvent(event: StreamEvent): string {
    return JSON.stringify(event) + "\n";
}

// reads a response body and yields one event per line. the network hands over bytes in arbitrary pieces, so a
// line can arrive in two halves: the incomplete rest of each piece waits for the next one
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let rest = "";
    try {
        while (true) {
            const { value, done } = await reader.read();
            rest += decoder.decode(value, { stream: !done });
            const lines = rest.split("\n");
            rest = lines.pop() ?? "";
            for (const line of lines) {
                if (line.trim()) yield JSON.parse(line) as StreamEvent;
            }
            if (done) break;
        }
        if (rest.trim()) yield JSON.parse(rest) as StreamEvent;
    } finally {
        reader.releaseLock();
    }
}
