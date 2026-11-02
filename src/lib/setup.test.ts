import { describe, expect, it } from "vitest";
import { GAMES, type Game } from "./games";
import { getSetup, SETUP } from "./setup";

// fact texts for a supported player count (fails the test if getSetup returns an error instead)
function factTexts(game: Game, players: number): string[] {
    const result = getSetup(game, players);
    if ("error" in result) throw new Error(result.error);
    return result.facts.map((f) => f.text);
}

describe("getSetup", () => {
    it("rulebook tables: the value for the given player count only", () => {
        // Azul factory displays (page 2)
        expect(factTexts("azul", 2)).toContain("5 Factory displays");
        expect(factTexts("azul", 3)).toContain("7 Factory displays");
        expect(factTexts("azul", 4)).toContain("9 Factory displays");
        expect(factTexts("azul", 3)).not.toContain("5 Factory displays");

        // Sushi Go! cards per player (page 2)
        expect(factTexts("sushi-go", 2)).toContain("Deal 10 cards to each player");
        expect(factTexts("sushi-go", 3)).toContain("Deal 9 cards to each player");
        expect(factTexts("sushi-go", 4)).toContain("Deal 8 cards to each player");
        expect(factTexts("sushi-go", 5)).toContain("Deal 7 cards to each player");

        // Wizard trick rounds (page 2)
        expect(factTexts("wizard", 3)).toContain("20 trick rounds");
        expect(factTexts("wizard", 4)).toContain("15 trick rounds");
        expect(factTexts("wizard", 5)).toContain("12 trick rounds");
        expect(factTexts("wizard", 6)).toContain("10 trick rounds");
        expect(factTexts("wizard", 5).filter((t) => t.endsWith("trick rounds"))).toHaveLength(1);
    });

    it("player-count rules apply only to their player counts", () => {
        const doubleRoutes = (players: number) => factTexts("ticket-to-ride", players).some((t) => t.includes("double route"));
        expect(doubleRoutes(2)).toBe(true);
        expect(doubleRoutes(3)).toBe(true);
        expect(doubleRoutes(4)).toBe(false);
        expect(doubleRoutes(5)).toBe(false);

        const puddingRule = (players: number) => factTexts("sushi-go", players).some((t) => t.includes("puddings"));
        expect(puddingRule(2)).toBe(true);
        expect(puddingRule(3)).toBe(false);
    });

    it("solo and multiplayer setup exclude each other", () => {
        const solo = (game: Game, players: number) => factTexts(game, players).some((t) => t.startsWith("Solo"));
        expect(solo("magic-maze", 1)).toBe(true);
        expect(solo("magic-maze", 4)).toBe(false);
        expect(factTexts("magic-maze", 1).some((t) => t.includes("marked with your number of players"))).toBe(false);
        expect(solo("calico", 1)).toBe(true);
        expect(solo("calico", 3)).toBe(false);
    });

    it("facts without a player list apply to every player count", () => {
        const firstGame = "For your first game, also return the 5 abbots and the 12 river tiles (dark back) to the box";
        expect(factTexts("carcassonne", 2)).toContain(firstGame);
        expect(factTexts("carcassonne", 5)).toContain(firstGame);
    });

    it("returns each fact with its rulebook page", () => {
        const result = getSetup("ticket-to-ride", 2);
        expect(result).toMatchObject({ game: "ticket-to-ride", players: 2 });
        expect("facts" in result && result.facts).toContainEqual({
            text: "Only one route of each double route can be claimed; the second route is then closed to all players",
            page: 4,
        });
    });

    it("unsupported player counts return an error instead of facts", () => {
        expect(getSetup("azul", 1)).toEqual({ game: "azul", players: 1, error: "azul is for 2-4 players." });
        expect(getSetup("azul", 5)).toEqual({ game: "azul", players: 5, error: "azul is for 2-4 players." });
        expect(getSetup("wizard", 2)).toHaveProperty("error");
        expect(getSetup("magic-maze", 9)).toHaveProperty("error");
    });

    it("the range edges themselves are supported", () => {
        expect(getSetup("azul", 2)).toHaveProperty("facts");
        expect(getSetup("azul", 4)).toHaveProperty("facts");
        expect(getSetup("magic-maze", 1)).toHaveProperty("facts");
        expect(getSetup("magic-maze", 8)).toHaveProperty("facts");
    });
});

// checks on the data itself, so a typo in SETUP (e.g. players: [6] for a 2-4 player game) is caught
describe("SETUP data", () => {
    it.each(GAMES)("%s: player range between 1 and 8", (game) => {
        const { minPlayers, maxPlayers } = SETUP[game];
        expect(minPlayers).toBeGreaterThanOrEqual(1);
        expect(maxPlayers).toBeLessThanOrEqual(8); // no supported game takes more than 8 (Magic Maze); catches a typo like 48
        expect(minPlayers).toBeLessThanOrEqual(maxPlayers);
    });

    it.each(GAMES)("%s: every supported player count gets at least one fact", (game) => {
        const { minPlayers, maxPlayers } = SETUP[game];
        for (let players = minPlayers; players <= maxPlayers; players++) {
            expect(factTexts(game, players).length).toBeGreaterThan(0);
        }
    });

    it.each(GAMES)("%s: player lists stay inside the player range, pages are positive", (game) => {
        const { minPlayers, maxPlayers, facts } = SETUP[game];
        for (const fact of facts) {
            expect(fact.page).toBeGreaterThan(0);
            for (const players of fact.players ?? []) {
                expect(players).toBeGreaterThanOrEqual(minPlayers);
                expect(players).toBeLessThanOrEqual(maxPlayers);
            }
        }
    });
});
