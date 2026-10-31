// chat API: POST { messages } → runs the agent on the server (API key never reaches browser) → { answer, sources, toolResults }
import { agent } from "../../../lib/agent";
import { extractResponse, toAgentMessages } from "../../../lib/chat-response";
import type { ChatMessage } from "../../../lib/chat-types";
import { z } from "zod";
import { chatRequestSchema } from "../../../lib/chat-schema";

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
    }
    const { messages } = parsed.data;
    const result = await agent.invoke({ messages: toAgentMessages(messages) });
    return Response.json(extractResponse(result.messages));
}
