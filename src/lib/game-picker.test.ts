import { describe, expect, it } from "vitest";
import { GAME_FACTS, pickGames } from "./game-picker";
import { GAMES } from "./games";

// only the game ids, to compare results as short lists
const picked = (filters: Parameters<typeof pickGames>[0]) => pickGames(filters).map((g) => g.game);

describe("pickGames", () => {
    it("without filters returns all 7 games", () => {
        expect(picked({})).toEqual([...GAMES]);
    });

    it("filters by player count, using the player ranges from the setup helper", () => {
        expect(picked({ players: 1 })).toEqual(["calico", "magic-maze"]);
        expect(picked({ players: 5 })).toEqual(["carcassonne", "magic-maze", "sushi-go", "ticket-to-ride", "wizard"]);
        expect(picked({ players: 7 })).toEqual(["magic-maze"]);
    });

    it("filters by the age of the youngest player, edges included", () => {
        expect(picked({ youngestAge: 8 })).toEqual(["azul", "carcassonne", "magic-maze", "sushi-go", "ticket-to-ride"]);
        expect(picked({ youngestAge: 10 })).toContain("wizard");
        expect(picked({ youngestAge: 13 })).not.toContain("calico");
        expect(picked({ youngestAge: 14 })).toContain("calico");
        expect(picked({ youngestAge: 7 })).toEqual([]);
    });

    it("filters by play time: the box's upper value must fit", () => {
        expect(picked({ maxMinutes: 20 })).toEqual(["magic-maze", "sushi-go"]); // Sushi Go! takes exactly 20
        expect(picked({ maxMinutes: 19 })).toEqual(["magic-maze"]);
        expect(picked({ maxMinutes: 45 })).not.toContain("ticket-to-ride"); // 30-60 minutes: may not fit
        expect(picked({ maxMinutes: 60 })).toEqual([...GAMES]);
    });

    it("combines the filters", () => {
        expect(picked({ players: 5, youngestAge: 8, maxMinutes: 30 })).toEqual(["magic-maze", "sushi-go"]);
        expect(picked({ players: 3, youngestAge: 9 })).toEqual(["azul", "carcassonne", "magic-maze", "sushi-go", "ticket-to-ride"]);
    });

    it("returns an empty list if no game fits", () => {
        expect(pickGames({ players: 7, maxMinutes: 10 })).toEqual([]);
    });

    it("returns each game with its player range, minimum age and play time", () => {
        expect(pickGames({ players: 7 })).toEqual([
            { game: "magic-maze", minPlayers: 1, maxPlayers: 8, minAge: 8, minMinutes: 3, maxMinutes: 15 },
        ]);
    });
});

// checks on the data itself, so a typo in GAME_FACTS is caught
describe("GAME_FACTS data", () => {
    it.each(GAMES)("%s: positive age, play time range in the right order", (game) => {
        const { minAge, minMinutes, maxMinutes } = GAME_FACTS[game];
        expect(minAge).toBeGreaterThan(0);
        expect(minMinutes).toBeGreaterThan(0);
        expect(minMinutes).toBeLessThanOrEqual(maxMinutes);
    });
});
