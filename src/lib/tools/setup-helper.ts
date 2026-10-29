// setup helper tool: thin wrapper around src/lib/setup.ts
import { tool } from "langchain";
import { z } from "zod";
import { GAMES } from "../games";
import { getSetup } from "../setup";

export const setupHelperTool = tool(
    async ({ game, players }) => JSON.stringify(getSetup(game, players)),
    {
        name: "get_player_count_setup",
        description:
            "Get the setup facts that depend on the number of players for one game (e.g. Azul factory displays, " +
            "Sushi Go! cards per player, Wizard number of rounds, Ticket to Ride double routes), each with its rulebook " +
            "page. Also says if the game can't be played with that many players. Use it for setup questions that " +
            "mention a player count; for the general setup steps, search the rulebook.",
        schema: z.object({
            game: z.enum(GAMES).describe("The game to set up"),
            players: z.number().int().min(1).max(8).describe("Number of players"),
        }),
    },
);