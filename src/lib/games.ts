// the 7 supported games; ids match the `game` metadata in chroma (filenames in data/clean/)
export const GAMES = ["azul", "calico", "carcassonne", "magic-maze", "sushi-go", "ticket-to-ride", "wizard"] as const;

export type Game = (typeof GAMES)[number];