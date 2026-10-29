// chat API: POST { messages } → runs the agent on the server (API key never reaches browser) → { answer, sources, toolResults }
import { agent } from "../../../lib/agent";
import { extractResponse, toAgentMessages } from "../../../lib/chat-response";
import type { ChatMessage } from "../../../lib/chat-types";

export async function POST(request: Request) {
    const body = await request.json();

    // minimal check for now; step 10 replaces it with a zod schema + tests
    const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const last = messages.at(-1);
    if (!last || last.role !== "user" || typeof last.content !== "string" || last.content.trim() === "") {
        return Response.json({ error: "messages must end with a non-empty user message" }, { status: 400 });
    }

    // the whole conversation goes to the agent, so follow-up questions keep the game and context
    const result = await agent.invoke({ messages: toAgentMessages(messages) });
    return Response.json(extractResponse(result.messages));
}
