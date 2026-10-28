// runs the agent on a few questions and prints every step: tool calls, tool results, answer and time
import { AIMessage, HumanMessage, ToolMessage } from "langchain";
import { agent } from "../src/lib/agent";

const QUESTIONS = [
    "In Carcassonne, do I get points for a half-built city?", // expected: 1 point per tile + shield, page 6
    "Wizard: what happens if I play a jester?",
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