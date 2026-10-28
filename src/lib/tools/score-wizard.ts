// wizard score tool: thin wrapper (zod schema + description) around src/lib/scoring/wizard.ts
import { tool } from "langchain";
import { z } from "zod";
import { scoreWizardRound } from "../scoring/wizard";

export const scoreWizardRoundTool = tool(
    async ({ players }) =>
        JSON.stringify(players.map((p) => ({ ...p, points: scoreWizardRound(p.predicted, p.won) }))),
    {
        name: "score_wizard_round",
        description:
            "Calculate Wizard points for one trick round from each player's prediction and tricks won. " +
            "Use it for every Wizard scoring question instead of calculating yourself.",
        schema: z.object({
            players: z
                .array(
                    z.object({
                        name: z.string().describe("Player name, or e.g. 'Player 1'"),
                        predicted: z.number().int().min(0).describe("Number of tricks the player predicted"),
                        won: z.number().int().min(0).describe("Number of tricks the player actually won"),
                    }),
                )
                .min(1)
                .max(6),
        }),
    },
);