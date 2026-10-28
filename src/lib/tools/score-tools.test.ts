import { describe, expect, it } from "vitest";
import { scoreSushiGoPuddingsTool, scoreSushiGoRoundTool } from "./score-sushi-go";
import { scoreWizardRoundTool } from "./score-wizard";

describe("score tools", () => {
    it("return the scoring result as JSON", async () => {
        const result = await scoreWizardRoundTool.invoke({ players: [{ name: "Henry", predicted: 2, won: 2 }] });
        expect(JSON.parse(result)).toEqual([{ name: "Henry", predicted: 2, won: 2, points: 40 }]);
    });

    it("reject invalid input before scoring", async () => {
        await expect(scoreWizardRoundTool.invoke({ players: [{ name: "Henry", predicted: -1, won: 2 }] })).rejects.toThrow();
        await expect(scoreSushiGoPuddingsTool.invoke({ players: [{ name: "Amy", puddings: 3 }] })).rejects.toThrow();
        await expect(
            scoreSushiGoRoundTool.invoke({
                players: [{ name: "Amy", makiIcons: 1.5, tempura: 0, sashimi: 0, dumplings: 0, nigiri: { squid: 0, salmon: 0, egg: 0 }, nigiriOnWasabi: { squid: 0, salmon: 0, egg: 0 } }],
            }),
        ).rejects.toThrow();
    });
});