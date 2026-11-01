// rulebook search tool: agent calls it with a rules question + game and gets the best-matching chunks
import { tool } from "langchain";
import { z } from "zod";
import type { Source } from "../chat-types";
import { GAMES } from "../games";
import { translateQuery } from "../query-translation";
import { getVectorStore } from "../vectorstore";

const K = 4;

export const searchRulebook = tool(
    async ({ query, game }): Promise<[string, Source[]]> => {
        // query translation: the agent's query is rewritten into the rulebook's vocabulary before the vector search
        const translated = await translateQuery(query, game);
        const results = await getVectorStore().similaritySearch(translated, K, { game });
        if (results.length === 0) return [`No rulebook passages found for ${game}.`, []];

        // page in front of every chunk, so the model can cite its sources
        const content = results
            .map((doc) => `[page ${doc.metadata.page}] ${doc.pageContent}`)
            .join("\n\n---\n\n");

        // the same passages as structured sources for the UI (one per section and page); the model never sees these
        const sources: Source[] = [];
        for (const doc of results) {
            const source = { game, section: String(doc.metadata.section), page: Number(doc.metadata.page) };
            if (!sources.some((s) => s.section === source.section && s.page === source.page)) sources.push(source);
        }
        return [content, sources];
    },
    {
        name: "search_rulebook",
        description:
            "Search the official rulebook of one board game. Use it for every rules question before answering. " +
            "Phrase the query with the rulebook's own terms (section names and rule words), not the player's wording.",
        schema: z.object({
            query: z.string().describe("The rules question, phrased with the rulebook's terms"),
            game: z.enum(GAMES).describe("The game whose rulebook to search"),
        }),
        // content goes to the model, the artifact (sources) stays on the ToolMessage for the API response
        responseFormat: "content_and_artifact",
    },
);
