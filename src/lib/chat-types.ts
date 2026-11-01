// types shared by the chat API route and the UI (no imports from langchain, so the client bundle stays small)
import type { Game } from "./games";

// one entry of the conversation as the UI sends it: text only, tool calls are not replayed.
// an assistant turn carries the signature the server gave the answer (src/lib/chat-signature.ts), so the route can
// tell its own earlier answers from turns the client wrote
export type UserMessage = { role: "user"; content: string };
export type AssistantMessage = { role: "assistant"; content: string; signature: string };
export type ChatMessage = UserMessage | AssistantMessage;

// a rulebook passage the agent read for this answer
export type Source = { game: Game; section: string; page: number };

// result of a domain tool (score, setup, picker) with the arguments the agent called it with
export type ToolResult = { tool: string; args: Record<string, unknown>; result: unknown };

// the answer with its signature (sent back with the next question) and what the UI shows under it
export type ChatResponse = { answer: string; signature: string; sources: Source[]; toolResults: ToolResult[] };
