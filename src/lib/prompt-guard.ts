// second guard against prompt extraction: the prompt rule asks the model not to reveal its instructions, this check
// catches it when the model does so anyway (verbatim or nearly: whitespace and case are ignored, paraphrases are not caught)
import { SYSTEM_PROMPT } from "./agent";

export const PROMPT_LEAK_ANSWER = "Sorry, I can't share my instructions. I can only help with the games' rules and setup.";

const MIN_LINE_LENGTH = 40;

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

// prompt lines long enough to be no coincidence; the leading "- " of the rules is dropped
const promptLines = (prompt: string) =>
    prompt
        .split("\n")
        .map((line) => normalise(line.replace(/^\s*-\s*/, "")))
        .filter((line) => line.length >= MIN_LINE_LENGTH);

// true when the answer contains a whole line of the prompt
export function leaksPrompt(answer: string, prompt: string = SYSTEM_PROMPT): boolean {
    const text = normalise(answer);
    return promptLines(prompt).some((line) => text.includes(line));
}
