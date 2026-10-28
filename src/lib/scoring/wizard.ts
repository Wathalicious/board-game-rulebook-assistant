// wizard scoring (rules in data/clean/wizard.md, page 2); pure function, no LLM, unit-tested

// correct prediction: 20 bonus + 10 per trick won; wrong prediction: -10 per trick above or below it
export function scoreWizardRound(predicted: number, won: number) {
    if (predicted === won) return 20 + 10 * won;
    return -10 * Math.abs(predicted - won);
}