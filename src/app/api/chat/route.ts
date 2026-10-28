// chat API: POST { message } → runs the agent on the server (API key never reaches browser) → { answer }
import { HumanMessage } from "langchain";
import { agent } from "../../../lib/agent";

export async function POST(request: Request) {
    const body = await request.json();

    // minimal check for now; step 10 replaces it with a zod schema + tests
    if (typeof body.message !== "string" || body.message.trim() === "") {
        return Response.json({ error: "message must be a non-empty string" }, { status: 400 });
    }

    const result = await agent.invoke({ messages: [new HumanMessage(body.message)] });
    return Response.json({ answer: result.messages.at(-1)?.text });
}