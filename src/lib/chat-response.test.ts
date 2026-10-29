import { AIMessage, HumanMessage, ToolMessage } from "langchain";
import { describe, expect, it } from "vitest";
import { extractResponse, toAgentMessages } from "./chat-response";

// builds the message list the agent produces for one turn: question → tool calls → tool results → answer
const question = new HumanMessage("Azul: how many factory displays for 3 players?");
const toolCalls = new AIMessage({
    content: "",
    tool_calls: [
        { id: "call-1", name: "search_rulebook", args: { query: "factory displays setup", game: "azul" } },
        { id: "call-2", name: "get_player_count_setup", args: { game: "azul", players: 3 } },
    ],
});
const searchResult = new ToolMessage({
    tool_call_id: "call-1",
    name: "search_rulebook",
    content: "[page 2] Place 7 Factory displays ...",
    artifact: [
        { game: "azul", section: "Game Setup", page: 2 },
        { game: "azul", section: "Game Setup", page: 2 }, // the tool dedupes, but the extractor must cope too
        { game: "azul", section: "Components", page: 1 },
    ],
});
const setupResult = new ToolMessage({
    tool_call_id: "call-2",
    name: "get_player_count_setup",
    content: JSON.stringify({ game: "azul", players: 3, facts: [{ text: "7 Factory displays", page: 2 }] }),
});
const answer = new AIMessage("For 3 players you need 7 Factory displays (page 2).");

describe("extractResponse", () => {
    it("takes the answer from the last AI message", () => {
        expect(extractResponse([question, toolCalls, searchResult, setupResult, answer]).answer).toBe(
            "For 3 players you need 7 Factory displays (page 2).",
        );
    });

    it("collects the sources from the search tool's artifact without duplicates", () => {
        expect(extractResponse([question, toolCalls, searchResult, setupResult, answer]).sources).toEqual([
            { game: "azul", section: "Game Setup", page: 2 },
            { game: "azul", section: "Components", page: 1 },
        ]);
    });

    it("returns the other tools' results parsed, together with their call arguments", () => {
        expect(extractResponse([question, toolCalls, searchResult, setupResult, answer]).toolResults).toEqual([
            {
                tool: "get_player_count_setup",
                args: { game: "azul", players: 3 },
                result: { game: "azul", players: 3, facts: [{ text: "7 Factory displays", page: 2 }] },
            },
        ]);
    });

    it("works for an answer without any tool calls", () => {
        const messages = [new HumanMessage("Which game are you playing?"), new AIMessage("Please tell me the game first.")];
        expect(extractResponse(messages)).toEqual({ answer: "Please tell me the game first.", sources: [], toolResults: [] });
    });

    it("passes a tool result through as text if it is not JSON", () => {
        const call = new AIMessage({ content: "", tool_calls: [{ id: "c", name: "some_tool", args: {} }] });
        const result = new ToolMessage({ tool_call_id: "c", name: "some_tool", content: "plain text" });
        expect(extractResponse([question, call, result, answer]).toolResults[0].result).toBe("plain text");
    });

    it("handles a search tool message without an artifact", () => {
        const result = new ToolMessage({ tool_call_id: "call-1", name: "search_rulebook", content: "No rulebook passages found." });
        expect(extractResponse([question, toolCalls, result, answer]).sources).toEqual([]);
    });

    it("returns an empty answer if the conversation ends without an AI message", () => {
        expect(extractResponse([question]).answer).toBe("");
    });
});

describe("toAgentMessages", () => {
    it("maps user and assistant turns to Human and AI messages in order", () => {
        const messages = toAgentMessages([
            { role: "user", content: "We play Wizard." },
            { role: "assistant", content: "Great, what is your question?" },
            { role: "user", content: "What does a jester do?" },
        ]);
        expect(messages.map((m) => m.constructor.name)).toEqual(["HumanMessage", "AIMessage", "HumanMessage"]);
        expect(messages.map((m) => m.text)).toEqual(["We play Wizard.", "Great, what is your question?", "What does a jester do?"]);
    });
});
