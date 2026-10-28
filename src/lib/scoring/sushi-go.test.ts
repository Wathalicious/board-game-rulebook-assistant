import { describe, expect, it } from "vitest";
import { scoreDumplings, scoreMaki, scoreNigiri, scorePuddings, scoreSashimi, scoreTempura } from "./sushi-go";

const none = { squid: 0, salmon: 0, egg: 0 };

describe("sushi go set cards", () => {
    it("scores tempura per pair, a single one is worth nothing", () => {
        expect([1, 2, 5].map(scoreTempura)).toEqual([0, 5, 10]);
    });

    it("scores sashimi per set of 3", () => {
        expect([2, 3, 7].map(scoreSashimi)).toEqual([0, 10, 20]);
    });

    it("follows the dumpling table, 5 or more = 15", () => {
        expect([0, 1, 2, 3, 4, 5, 8].map(scoreDumplings)).toEqual([0, 1, 3, 6, 10, 15, 15]);
    });

    it("triples nigiri on wasabi", () => {
        expect(scoreNigiri({ squid: 1, salmon: 1, egg: 1 }, none)).toBe(6);
        expect(scoreNigiri(none, { squid: 1, salmon: 1, egg: 1 })).toBe(18);
    });
});

describe("scoreMaki", () => {
    it("rulebook example (page 3): most gets 6, tied second place splits 3", () => {
        // Chris 5, Phil 3, Amy 3, Lisa 2
        expect(scoreMaki([5, 3, 3, 2])).toEqual([6, 1, 1, 0]);
    });

    it("tie for most splits 6 and awards no second place", () => {
        expect(scoreMaki([4, 4, 2])).toEqual([3, 3, 0]);
    });

    it("players without maki score nothing", () => {
        expect(scoreMaki([3, 0, 0])).toEqual([6, 0, 0]);
        expect(scoreMaki([0, 0])).toEqual([0, 0]);
    });
});

describe("scorePuddings", () => {
    it("rulebook example (page 5): most gets 6, tied fewest split -6", () => {
        // Chris 4, Phil 3, Lisa 0, Amy 0
        expect(scorePuddings([4, 3, 0, 0])).toEqual([6, 0, -3, -3]);
    });

    it("all tied: nobody scores", () => {
        expect(scorePuddings([2, 2, 2])).toEqual([0, 0, 0]);
    });

    it("2 players: nobody loses points", () => {
        expect(scorePuddings([3, 1])).toEqual([6, 0]);
    });

    it("ignores the remainder when splitting negative points", () => {
        expect(scorePuddings([5, 1, 1, 1, 1])).toEqual([6, -1, -1, -1, -1]);
    });
});