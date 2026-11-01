// query translation: an explicit rewrite step before retrieval (one extra model call per search).
// the agent already phrases the search query itself; this step rewrites that query once more into the rulebook's
// vocabulary (section names, rule words, component names), because embeddings match words, not intent.
// a failed or empty rewrite falls back to the original query, so retrieval never breaks because of this step.
import { HumanMessage, SystemMessage } from "langchain";
import { GAME_NAMES, type Game } from "./games";
import { chatModel } from "./llm";

const translationPrompt = (game: Game) =>
    `You rewrite search queries for the official rulebook of the board game ${GAME_NAMES[game]}.
Rewrite the query into the words a rulebook uses: section names, rule terms, component names, scoring terms.
Keep every number, name and game term from the query. Add synonyms the rulebook might use.
Reply with the rewritten query only: one line, no quotes, no explanation.`;

export async function translateQuery(query: string, game: Game): Promise<string> {
    try {
        const response = await chatModel.invoke([new SystemMessage(translationPrompt(game)), new HumanMessage(query)]);
        const rewritten = response.text.trim().replace(/^["']|["']$/g, "");
        return rewritten || query;
    } catch (err) {
        console.warn("query translation failed, searching with the original query:", err);
        return query;
    }
}
