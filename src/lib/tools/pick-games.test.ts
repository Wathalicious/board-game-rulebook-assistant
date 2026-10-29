import { describe, expect, it } from "vitest";
import { gamePickerTool } from "./pick-games";

describe("game picker tool", () => {
    it("returns the fitting games as JSON", async () => {
        const result = JSON.parse(await gamePickerTool.invoke({ players: 7 }));
        expect(result).toEqual([{ game: "magic-maze", minPlayers: 1, maxPlayers: 8, minAge: 8, minMinutes: 3, maxMinutes: 15 }]);
    });

    it("all filters are optional", async () => {
        expect(JSON.parse(await gamePickerTool.invoke({}))).toHaveLength(7);
    });

    it("returns an empty JSON list if no game fits", async () => {
        expect(await gamePickerTool.invoke({ players: 7, maxMinutes: 10 })).toBe("[]");
    });

    it("rejects invalid input before running", async () => {
        await expect(gamePickerTool.invoke({ players: 0 })).rejects.toThrow();
        await expect(gamePickerTool.invoke({ players: 9 })).rejects.toThrow();
        await expect(gamePickerTool.invoke({ youngestAge: 0 })).rejects.toThrow();
        await expect(gamePickerTool.invoke({ maxMinutes: 0 })).rejects.toThrow();
        await expect(gamePickerTool.invoke({ maxMinutes: 2.5 })).rejects.toThrow();
    });
});
