// types shared by the chat API route and the UI (no imports from langchain, so the client bundle stays small)
import type { Game } from "./games";

export type UserMessage = { role: "user"; content: string };
export type AssistantMessage = { role: "assistant"; content: string; signature: string };
export type ChatMessage = UserMessage | AssistantMessage;

export type Source = { game: Game; section: string; page: number };

export type ToolResult = { tool: string; args: Record<string, unknown>; result: unknown };

export type ChatResponse = { answer: string; signature: string; sources: Source[]; toolResults: ToolResult[] };

export type StreamEvent =
    | { type: "text"; text: string }
    | { type: "clear" }
    | { type: "tools"; sources: Source[]; toolResults: ToolResult[] }
    | { type: "done"; response: ChatResponse }
    | { type: "error"; error: string };
