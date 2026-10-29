// types shared by the chat API route and the UI (no imports from langchain, so the client bundle stays small)
import type { Game } from "./games";

export type ChatRole = "user" | "assistant";

// one entry of the conversation as the UI sends it: text only, tool calls are not replayed
export type ChatMessage = { role: ChatRole; content: string };

// a rulebook passage the agent read for this answer
export type Source = { game: Game; section: string; page: number };

// result of a domain tool (score, setup, picker) with the arguments the agent called it with
export type ToolResult = { tool: string; args: Record<string, unknown>; result: unknown };

export type ChatResponse = { answer: string; sources: Source[]; toolResults: ToolResult[] };
