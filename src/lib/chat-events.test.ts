import { describe, expect, it } from "vitest";
import { encodeEvent, readEvents } from "./chat-events";
import type { StreamEvent } from "./chat-types";

// a body that arrives in the given pieces, like a network stream would
function body(...pieces: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const piece of pieces) controller.enqueue(encoder.encode(piece));
            controller.close();
        },
    });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<StreamEvent[]> {
    const events: StreamEvent[] = [];
    for await (const event of readEvents(stream)) events.push(event);
    return events;
}

const text: StreamEvent = { type: "text", text: "With 5 players " };
const done: StreamEvent = {
    type: "done",
    response: { answer: "With 5 players you play 12 rounds (page 2).", signature: "sig", sources: [], toolResults: [] },
};

describe("readEvents", () => {
    it("yields one event per line", async () => {
        expect(await collect(body(encodeEvent(text) + encodeEvent(done)))).toEqual([text, done]);
    });

    it("joins a line that arrives in two pieces", async () => {
        const line = encodeEvent(done);
        const cut = line.indexOf("signature");
        expect(await collect(body(encodeEvent(text), line.slice(0, cut), line.slice(cut)))).toEqual([text, done]);
    });

    it("yields the last line even without a trailing newline, and skips empty lines", async () => {
        expect(await collect(body(encodeEvent(text) + "\n\n" + JSON.stringify(done)))).toEqual([text, done]);
    });

    it("yields nothing for an empty body", async () => {
        expect(await collect(body())).toEqual([]);
    });
});
