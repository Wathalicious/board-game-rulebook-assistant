// game picker: filters the 7 games by player count, age of the youngest player and play time
import { GAMES, type Game } from "./games";
import { SETUP } from "./setup";

type GameFacts = { minAge: number; minMinutes: number; maxMinutes: number };

// values from the game boxes, except where a rulebook page is given; player counts come from SETUP
export const GAME_FACTS: Record<Game, GameFacts> = {
    azul: { minAge: 8, minMinutes: 30, maxMinutes: 45 },
    calico: { minAge: 14, minMinutes: 30, maxMinutes: 45 }, // age: rulebook p. 2
    carcassonne: { minAge: 8, minMinutes: 30, maxMinutes: 45 },
    "magic-maze": { minAge: 8, minMinutes: 3, maxMinutes: 15 },
    "sushi-go": { minAge: 8, minMinutes: 20, maxMinutes: 20 },
    "ticket-to-ride": { minAge: 8, minMinutes: 30, maxMinutes: 60 }, // rulebook p. 1
    wizard: { minAge: 10, minMinutes: 45, maxMinutes: 45 }, // rulebook p. 1: "about 45 minutes"
};

export type PickFilters = { players?: number; youngestAge?: number; maxMinutes?: number };

export function pickGames(filters: PickFilters) {
    return GAMES.filter((game) => {
        const { minPlayers, maxPlayers } = SETUP[game];
        const facts = GAME_FACTS[game];
        if (filters.players !== undefined && (filters.players < minPlayers || filters.players > maxPlayers)) return false;
        if (filters.youngestAge !== undefined && filters.youngestAge < facts.minAge) return false;
        // the game must fit even if it takes as long as the box's upper value
        if (filters.maxMinutes !== undefined && facts.maxMinutes > filters.maxMinutes) return false;
        return true;
    }).map((game) => ({ game, minPlayers: SETUP[game].minPlayers, maxPlayers: SETUP[game].maxPlayers, ...GAME_FACTS[game] }));
}