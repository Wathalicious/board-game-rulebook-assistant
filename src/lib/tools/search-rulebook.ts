// rulebook search tool: agent calls it with a rules question + game and gets the best-matching chunks
import { tool } from "langchain";
import { z } from "zod";
import { GAMES } from "../games";
import { getVectorStore } from "../vectorstore";

const K = 4;

export const searchRulebook = tool(
    async ({ query, game }) => {
        const results = await getVectorStore().similaritySearch(query, K, { game });
        if (results.length === 0) return `No rulebook passages found for ${game}.`;

        // page in front of every chunk, so the model can cite its sources
        return results
            .map((doc) => `[page ${doc.metadata.page}] ${doc.pageContent}`)
            .join("\n\n---\n\n");
    },
    {
        name: "search_rulebook",
        description:
            "Search the official rulebook of one board game. Use it for every rules question before answering. " +
            "Phrase the query with the rulebook's terms (e.g. 'incomplete city final scoring' instead of 'half-built city').",
        schema: z.object({
            query: z.string().describe("The rules question, phrased with the rulebook's terms"),
            game: z.enum(GAMES).describe("The game whose rulebook to search"),
        }),
    },
);