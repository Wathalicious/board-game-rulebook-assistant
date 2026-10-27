import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./chunking";

describe("parseMarkdown", () => {
    it("creates one piece per section with game, section and page", () => {
        const markdown = ["# Azul", "## Setup", "<!-- page: 2 -->", "Place the factory displays."].join("\n");

        expect(parseMarkdown("azul", markdown)).toEqual([
            { game: "azul", section: "Setup", page: 2, text: "Place the factory displays." },
        ]);
    });

    // "## Gameplay" has no text of its own, so it must not become an empty piece
    it("joins nested headings, resets the subsection at the next ## and skips empty headings", () => {
        const markdown = [
            "## Gameplay", "<!-- page: 3 -->",
            "### Floor Line", "<!-- page: 4 -->", "Excess tiles go here.",
            "## End of the Game", "<!-- page: 6 -->", "The game ends.",
        ].join("\n");

        expect(parseMarkdown("azul", markdown)).toEqual([
            { game: "azul", section: "Gameplay > Floor Line", page: 4, text: "Excess tiles go here." },
            { game: "azul", section: "End of the Game", page: 6, text: "The game ends." },
        ]);
    });

    it("splits a section into two pieces when the page changes", () => {
        const markdown = ["## Scoring", "<!-- page: 5 -->", "First part.", "<!-- page: 6 -->", "Second part."].join("\n");

        expect(parseMarkdown("azul", markdown)).toEqual([
            { game: "azul", section: "Scoring", page: 5, text: "First part." },
            { game: "azul", section: "Scoring", page: 6, text: "Second part." },
        ]);
    });

    // files edited on Windows can have \r\n line endings
    it("handles Windows line endings", () => {
        const markdown = ["## Setup", "<!-- page: 2 -->", "Line one.", "Line two."].join("\r\n");

        expect(parseMarkdown("azul", markdown)).toEqual([
            { game: "azul", section: "Setup", page: 2, text: "Line one.\nLine two." },
        ]);
    });
});