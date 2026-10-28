// runs the agent on a few questions and prints every step: tool calls, tool results, answer and time
import { AIMessage, HumanMessage, ToolMessage } from "langchain";
import { agent } from "../src/lib/agent";

const QUESTIONS = [
    // expected: Anna 3, Ben 3, Cleo 0, Dan 0 (tie for most splits 6, no second place)
    "Sushi Go, 4 players. Maki roll icons: Anna 4, Ben 4, Cleo 3, Dan 1. How many maki points does everyone get?",
    // expected: Anna 6, Ben/Cleo/Dan/Eva -1 each (-6 split 4 ways, remainder ignored)
    "Sushi Go game end, 5 players. Puddings: Anna 5, Ben 1, Cleo 1, Dan 1, Eva 1. What are the pudding points?",
    // expected: me 41 (maki 6, tempura 5, sashimi 10, dumplings 10, nigiri 10), opponent 25 (maki 3, tempura 5, dumplings 15, nigiri 2)
    "Sushi Go, 2 players. I have 3 maki roll icons, 3 tempura, 4 sashimi, 4 dumplings, a squid nigiri on wasabi and an egg nigiri. " +
        "My opponent has 1 maki roll icon, 2 tempura, 5 dumplings and a salmon nigiri. What do we each score this round?",
    // expected: Anna -20, Ben 50, Cleo -10
    "Wizard: Anna predicted 0 and won 2 tricks, Ben predicted 3 and won 3, Cleo predicted 2 and won 1. How many points does each get this round?",
];

async function main() {
    for (const question of QUESTIONS) {
        console.log(`\n=== ${question}`);
        const start = Date.now();
        const result = await agent.invoke({ messages: [new HumanMessage(question)] });
        const seconds = ((Date.now() - start) / 1000).toFixed(1);

        for (const m of result.messages) {
            if (AIMessage.isInstance(m) && m.tool_calls?.length) {
                for (const call of m.tool_calls) console.log("TOOL CALL  ", call.name, call.args);
            } else if (ToolMessage.isInstance(m)) {
                console.log("TOOL RESULT", m.text.slice(0, 120).replaceAll("\n", " "), "...");
            }
        }
        console.log(`ANSWER (${seconds}s):\n${result.messages.at(-1)?.text}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});