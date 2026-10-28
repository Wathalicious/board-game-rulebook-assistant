import { describe, expect, it } from "vitest";
import { scoreWizardRound } from "./wizard";

describe("scoreWizardRound", () => {
    it("rulebook example (page 2): Henry, Anya and Freya in round 3", () => {
        expect(scoreWizardRound(2, 2)).toBe(40); // Henry: 10 + 10 + 20
        expect(scoreWizardRound(2, 1)).toBe(-10); // Anya: one trick short
        expect(scoreWizardRound(0, 0)).toBe(20); // Freya: only the bonus
    });

    it("loses 10 per trick off, above or below the prediction", () => {
        expect(scoreWizardRound(1, 4)).toBe(-30);
        expect(scoreWizardRound(4, 1)).toBe(-30);
    });

    it("a wrong prediction scores no points for tricks won", () => {
        expect(scoreWizardRound(0, 2)).toBe(-20);
    });
});