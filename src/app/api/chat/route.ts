// chat API: POST { messages } → runs the agent on the server (API key never reaches browser) → { answer, sources, toolResults }
import { agent } from "../../../lib/agent";
import { extractResponse, toAgentMessages } from "../../../lib/chat-response";
import { z } from "zod";
import { chatRequestSchema } from "../../../lib/chat-schema";
import { toErrorResponse } from "../../../lib/chat-errors";
import { checkChroma } from "../../../lib/vectorstore";

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
    }
    const { messages } = parsed.data;
    
    try {
        await checkChroma();
        const result = await agent.invoke({ messages: toAgentMessages(messages) });
        return Response.json(extractResponse(result.messages));
    } catch (err) {
        console.error("POST /api/chat failed:", err);
        const { status, error } = toErrorResponse(err);
        return Response.json({ error }, { status });
    }
}
