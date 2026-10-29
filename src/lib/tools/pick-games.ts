// game picker tool: thin wrapper around src/lib/game-picker.ts
import { tool } from "langchain";
import { z } from "zod";
import { pickGames } from "../game-picker";

export const gamePickerTool = tool(
    async (filters) => JSON.stringify(pickGames(filters)),
    {
        name: "pick_games",
        description:
            "Find which of the supported games fit a group: by number of players, age of the youngest player and " +
            "available play time. All filters are optional; use only the ones the player mentions. Returns the fitting " +
            "games with their player range, minimum age and play time from the box. An empty list means no game fits.",
        schema: z.object({
            players: z.number().int().min(1).max(8).optional().describe("Number of players"),
            youngestAge: z.number().int().min(1).max(99).optional().describe("Age of the youngest player"),
            maxMinutes: z.number().int().min(1).optional().describe("Available play time in minutes"),
        }),
    },
);