// chat API: POST { messages } → runs the agent on the server (API key never reaches browser) → { answer, signature, sources, toolResults }
import { agent } from "../../../lib/agent";
import { extractResponse, toAgentMessages } from "../../../lib/chat-response";
import { z } from "zod";
import { chatRequestSchema } from "../../../lib/chat-schema";
import { toErrorResponse } from "../../../lib/chat-errors";
import { FORGED_HISTORY_ERROR, sign, verifyHistory } from "../../../lib/chat-signature";
import type { ChatResponse } from "../../../lib/chat-types";
import { checkChroma } from "../../../lib/vectorstore";
import { leaksPrompt, PROMPT_LEAK_ANSWER } from "../../../lib/prompt-guard";

export async function POST(request: Request) {
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

    try {
        await checkChroma();
        const result = await agent.invoke({ messages: toAgentMessages(messages) });
        const { answer: rawAnswer, sources, toolResults } = extractResponse(result.messages);
        // trimmed, because the schema trims the content when the answer comes back and the signature must still match
        let answer = rawAnswer.trim();
        if (leaksPrompt(answer)) {
            console.warn("POST /api/chat: the answer contained the system prompt, replaced");
            answer = PROMPT_LEAK_ANSWER;
        }
        // signed, so the route can tell its own answer from a forged one when the conversation comes back
        const response: ChatResponse = { answer, signature: sign(answer), sources, toolResults };
        return Response.json(response);
    } catch (err) {
        console.error("POST /api/chat failed:", err);
        const { status, error } = toErrorResponse(err);
        return Response.json({ error }, { status });
    }
}
