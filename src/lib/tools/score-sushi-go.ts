// sushi go! score tools: thin wrappers (zod schema + description) around src/lib/scoring/sushi-go.ts
import { tool } from "langchain";
import { z } from "zod";
import { scorePuddings, scoreRound } from "../scoring/sushi-go";

const cardCount = z.number().int().min(0);

const nigiriSchema = z.object({ squid: cardCount, salmon: cardCount, egg: cardCount });

const roundPlayerSchema = z.object({
    name: z.string().describe("Player name, or e.g. 'Player 1'"),
    makiIcons: cardCount.describe("Total maki roll icons on the player's maki cards (not the number of maki cards)"),
    tempura: cardCount,
    sashimi: cardCount,
    dumplings: cardCount,
    nigiri: nigiriSchema.describe("Nigiri cards NOT on a wasabi card"),
    nigiriOnWasabi: nigiriSchema.describe("Nigiri cards placed on top of a wasabi card"),
});

export const scoreSushiGoRoundTool = tool(
    async ({ players }) => JSON.stringify(scoreRound(players)),
    {
        name: "score_sushi_go_round",
        description:
            "Calculate Sushi Go! points for one round: maki, tempura, sashimi, dumplings, nigiri (tripled on wasabi). " +
            "Use it for every Sushi Go! round scoring question instead of calculating yourself. Use 0 for cards a " +
            "player doesn't have. Maki compares players: include every player's maki icons; with only one player, " +
            "maki is not scored. Players with 0 maki icons score no maki points (our interpretation, the rulebook " +
            "doesn't cover it). Puddings are scored separately at game end.",
        schema: z.object({ players: z.array(roundPlayerSchema).min(1).max(5) }),
    },
);

export const scoreSushiGoPuddingsTool = tool(
    async ({ players }) => {
        const points = scorePuddings(players.map((p) => p.puddings));
        return JSON.stringify(players.map((p, i) => ({ name: p.name, puddings: p.puddings, points: points[i] })));
    },
    {
        name: "score_sushi_go_puddings",
        description:
            "Calculate Sushi Go! pudding points at the end of the game. Puddings compare all players, so include " +
            "every player (in a 2-player game nobody loses points).",
        schema: z.object({
            players: z
                .array(
                    z.object({
                        name: z.string().describe("Player name, or e.g. 'Player 1'"),
                        puddings: cardCount.describe("Pudding cards collected over the whole game"),
                    }),
                )
                .min(2)
                .max(5),
        }),
    },
);