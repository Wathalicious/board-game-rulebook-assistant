// glue between the UI's chat history and the agent: history → agent input, agent messages → API response
import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from "langchain";
import type { ChatMessage, ChatResponse, Source, ToolResult } from "./chat-types";

const SEARCH_TOOL = "search_rulebook";

export function toAgentMessages(history: ChatMessage[]): BaseMessage[] {
    return history.map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)));
}

// the last AI message is the answer; ToolMessages give the sources (search tool) and tool results (other tools).
// the signature is not part of this: the route signs the answer it finally returns (after the prompt-leak check)
export function extractResponse(messages: BaseMessage[]): Omit<ChatResponse, "signature"> {
    // tool call arguments by call id, so a result can be shown together with its input
    const callArgs = new Map<string, Record<string, unknown>>();
    const sources: Source[] = [];
    const toolResults: ToolResult[] = [];

    for (const m of messages) {
        if (AIMessage.isInstance(m)) {
            for (const call of m.tool_calls ?? []) {
                if (call.id) callArgs.set(call.id, call.args);
            }
        } else if (ToolMessage.isInstance(m)) {
            if (m.name === SEARCH_TOOL) {
                // the search tool puts its sources in the artifact (the model only sees the text)
                for (const source of (m.artifact as Source[] | undefined) ?? []) {
                    if (!sources.some((s) => s.game === source.game && s.section === source.section && s.page === source.page)) {
                        sources.push(source);
                    }
                }
            } else {
                toolResults.push({ tool: m.name ?? "unknown", args: callArgs.get(m.tool_call_id) ?? {}, result: parseJson(m.text) });
            }
        }
    }

    const last = messages.at(-1);
    const answer = last && AIMessage.isInstance(last) ? last.text : "";
    return { answer, sources, toolResults };
}

// the domain tools return JSON strings; anything else is passed through as text
function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
