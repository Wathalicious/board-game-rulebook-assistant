// the 7 supported games; ids match the `game` metadata in chroma (filenames in data/clean/)
export const GAMES = ["azul", "calico", "carcassonne", "magic-maze", "sushi-go", "ticket-to-ride", "wizard"] as const;

export type Game = (typeof GAMES)[number];

// display names for the UI (the ids stay lowercase for chroma, tool schemas and file names)
export const GAME_NAMES: Record<Game, string> = {
    azul: "Azul",
    calico: "Calico",
    carcassonne: "Carcassonne",
    "magic-maze": "Magic Maze",
    "sushi-go": "Sushi Go!",
    "ticket-to-ride": "Ticket to Ride",
    wizard: "Wizard",
};
