// chat API: POST { messages } → runs the agent on the server (API key never reaches browser) → a stream of events
// (src/lib/chat-events.ts): the answer as it is written, then the finished answer { answer, signature, sources, toolResults }
import { z } from "zod";
import { agent } from "../../../lib/agent";
import { toErrorResponse } from "../../../lib/chat-errors";
import { encodeEvent, STREAM_CONTENT_TYPE } from "../../../lib/chat-events";
import { extractResponse, toAgentMessages } from "../../../lib/chat-response";
import { chatRequestSchema } from "../../../lib/chat-schema";
import { FORGED_HISTORY_ERROR, sign, verifyHistory } from "../../../lib/chat-signature";
import { primed, relayAgentStream, type AgentStream } from "../../../lib/chat-stream";
import type { ChatResponse, StreamEvent } from "../../../lib/chat-types";
import { leaksPrompt, PROMPT_LEAK_ANSWER } from "../../../lib/prompt-guard";
import { clientKey, createRateLimiter } from "../../../lib/rate-limit";
import { checkChroma } from "../../../lib/vectorstore";

// one limiter for the whole process (RATE_LIMIT questions per client in RATE_WINDOW_MS, see rate-limit.ts)
const limiter = createRateLimiter();

export async function POST(request: Request) {
    // cheapest check first: a refused request costs nothing, an answered one costs several model calls
    const rate = limiter.check(clientKey(request));
    if (!rate.allowed) {
        return Response.json(
            { error: `Too many questions in a short time, wait ${rate.retryAfterSeconds} seconds.` },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
        );
    }

    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
    }
    const { messages } = parsed.data;
    // the schema checked that every assistant turn has a signature; this checks that this server produced it
    if (!verifyHistory(messages)) {
        console.warn("POST /api/chat: an assistant turn in the history has a wrong signature, rejected");
        return Response.json({ error: FORGED_HISTORY_ERROR }, { status: 400 });
    }

    let events: AgentStream;
    try {
        await checkChroma();
        const stream = (await agent.stream(
            { messages: toAgentMessages(messages) },
            // tokens as they come plus whole messages per step; the request's signal stops the agent if the browser leaves
            { streamMode: ["updates", "messages"], signal: request.signal },
        )) as unknown as AgentStream;
        // wait for the agent's first event before the response starts: an error from the first model call (rejected
        // key, provider rate limit) throws here and still gets its own HTTP status
        events = await primed(stream);
    } catch (err) {
        console.error("POST /api/chat failed:", err);
        const { status, error } = toErrorResponse(err);
        return Response.json({ error }, { status });
    }

    // from here on the status is 200 and everything, a failure included, is an event in the stream
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: StreamEvent) => controller.enqueue(encoder.encode(encodeEvent(event)));
            try {
                const produced = await relayAgentStream(events, send);
                const { answer: rawAnswer, sources, toolResults } = extractResponse(produced);
                // trimmed, because the schema trims the content when the answer comes back and the signature must still match
                let answer = rawAnswer.trim();
                if (leaksPrompt(answer)) {
                    console.warn("POST /api/chat: the answer contained the system prompt, replaced");
                    answer = PROMPT_LEAK_ANSWER;
                }
                // signed, so the route can tell its own answer from a forged one when the conversation comes back.
                // the done event replaces everything the UI showed while streaming
                const response: ChatResponse = { answer, signature: sign(answer), sources, toolResults };
                send({ type: "done", response });
            } catch (err) {
                console.error("POST /api/chat failed while streaming:", err);
                send({ type: "error", error: toErrorResponse(err).error });
            } finally {
                controller.close();
            }
        },
    });
    return new Response(responseStream, { headers: { "Content-Type": STREAM_CONTENT_TYPE, "Cache-Control": "no-cache" } });
}
