import { describe, expect, it } from "vitest";
import { setupHelperTool } from "./setup-helper";

describe("setup helper tool", () => {
    it("returns the setup facts as JSON", async () => {
        const result = JSON.parse(await setupHelperTool.invoke({ game: "azul", players: 3 }));
        expect(result.game).toBe("azul");
        expect(result.facts).toContainEqual({ text: "7 Factory displays", page: 2 });
    });

    it("returns the error as JSON for a player count the game doesn't support", async () => {
        // not a tool failure: the model should pass the message on to the player
        const result = JSON.parse(await setupHelperTool.invoke({ game: "azul", players: 5 }));
        expect(result).toEqual({ game: "azul", players: 5, error: "azul is for 2-4 players." });
        // the schema has no upper cap: a count above every game's maximum (8) gets the same kind of message
        const many = JSON.parse(await setupHelperTool.invoke({ game: "magic-maze", players: 13 }));
        expect(many).toEqual({ game: "magic-maze", players: 13, error: "magic-maze is for 1-8 players." });
    });

    it("rejects invalid input before running", async () => {
        await expect(setupHelperTool.invoke({ game: "azul", players: 0 })).rejects.toThrow();
        await expect(setupHelperTool.invoke({ game: "azul", players: 2.5 })).rejects.toThrow();
        // @ts-expect-error unknown game id, rejected by the zod enum
        await expect(setupHelperTool.invoke({ game: "monopoly", players: 3 })).rejects.toThrow();
    });
});
