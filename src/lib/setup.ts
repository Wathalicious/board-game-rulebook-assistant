// setup helper: setup facts that depend on the number of players, per game, with rulebook page
import type { Game } from "./games";

type SetupFact = {
    text: string;
    page: number;
    players?: number[];
};

type GameSetup = { minPlayers: number; maxPlayers: number; facts: SetupFact[] };

export const SETUP: Record<Game, GameSetup> = {
    azul: {
        minPlayers: 2,
        maxPlayers: 4,
        facts: [
            { text: "5 Factory displays", page: 2, players: [2] },
            { text: "7 Factory displays", page: 2, players: [3] },
            { text: "9 Factory displays", page: 2, players: [4] },
            { text: "Fill each Factory display with exactly 4 tiles from the bag", page: 2 },
        ],
    },
    calico: {
        minPlayers: 1,
        maxPlayers: 4,
        facts: [
            { text: "Each player draws 2 Patch Tiles into their hand; reveal 3 Patch Tiles as the tile market", page: 4 },
            {
                text: "Solo mode: after choosing your tile from the market, discard the market tile furthest from the supply, slide the remaining tile away from the supply and refill the market one tile at a time",
                page: 8,
                players: [1],
            },
            {
                text: "Optional (less randomness): before setup, remove one set of 36 Patch Tiles (each color-pattern combination once)",
                page: 8,
                players: [1, 2],
            },
        ],
    },
    carcassonne: {
        minPlayers: 2, // player count is not in the rulebook: from the box
        maxPlayers: 5,
        facts: [
            { text: "Each player takes 7 meeple of their colour as their supply and places their 8th meeple on space 0 of the scoreboard", page: 2 },
            { text: "Return the meeple of unused colours to the box", page: 2 },
            { text: "For your first game, also return the 5 abbots and the 12 river tiles (dark back) to the box", page: 2 },
        ],
    },
    "magic-maze": {
        minPlayers: 1,
        maxPlayers: 8,
        facts: [
            {
                text: "Take the Action tiles marked with your number of players (lower-right corner) and give one to each player, North arrow pointing the same way as on the starting tile",
                page: 3,
                players: [2, 3, 4, 5, 6, 7, 8],
            },
            {
                text: "Solo game: take the 7 Action tiles for 1-player games, North arrow pointing the same way as on the starting tile, shuffle them and place them as a face-down deck",
                page: 3,
                players: [1],
            },
        ],
    },
    "sushi-go": {
        minPlayers: 2,
        maxPlayers: 5,
        facts: [
            { text: "Deal 10 cards to each player", page: 2, players: [2] },
            { text: "Deal 9 cards to each player", page: 2, players: [3] },
            { text: "Deal 8 cards to each player", page: 2, players: [4] },
            { text: "Deal 7 cards to each player", page: 2, players: [5] },
            { text: "The game takes place over 3 rounds", page: 2 },
            { text: "In a 2-player game, no one loses points for puddings; only the most puddings score", page: 5, players: [2] },
            {
                text: "Optional two-player variant with a third 'dummy' player: deal 3 hands of 9 cards",
                page: 5,
                players: [2],
            },
        ],
    },
    "ticket-to-ride": {
        minPlayers: 2,
        maxPlayers: 5,
        facts: [
            { text: "Each player takes 45 trains and places their scoring marker on 0", page: 2 },
            {
                text: "Deal 4 train cards to each player; turn 5 train cards face up (if 3 or more of them are locomotives, discard all 5 and turn up 5 new ones)",
                page: 2,
            },
            { text: "Deal 4 tickets to each player; each player must keep at least 2", page: 2 },
            {
                text: "Only one route of each double route can be claimed; the second route is then closed to all players",
                page: 4,
                players: [2, 3],
            },
        ],
    },
    wizard: {
        minPlayers: 3,
        maxPlayers: 6,
        facts: [
            { text: "20 trick rounds", page: 2, players: [3] },
            { text: "15 trick rounds", page: 2, players: [4] },
            { text: "12 trick rounds", page: 2, players: [5] },
            { text: "10 trick rounds", page: 2, players: [6] },
            { text: "Round 1: deal 1 card to each player, round 2: 2 cards, and so on", page: 1 },
            { text: "In the last round all cards are dealt, so there is no trump color", page: 1 },
        ],
    },
};

export type SetupResult =
    | { game: Game; players: number; facts: { text: string; page: number }[] }
    | { game: Game; players: number; error: string };

export function getSetup(game: Game, players: number): SetupResult {
    const setup = SETUP[game];
    if (players < setup.minPlayers || players > setup.maxPlayers) {
        return { game, players, error: `${game} is for ${setup.minPlayers}-${setup.maxPlayers} players.` };
    }
    const facts = setup.facts
        .filter((f) => !f.players || f.players.includes(players))
        .map(({ text, page }) => ({ text, page }));
    return { game, players, facts };
}