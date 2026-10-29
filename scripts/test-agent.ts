// runs the agent on a few questions and prints every step: tool calls, tool results, answer and time
// checks automatically whether the expected tools were called; the answers themselves are checked by reading them
import { AIMessage, HumanMessage, ToolMessage } from "langchain";
import { agent } from "../src/lib/agent";

type TestQuestion = {
    label: string;
    question: string;
    expected: string;
    tools: string[]; // exactly these tools should be called (order and repeats don't matter)
};

const QUESTIONS: TestQuestion[] = [
    // scoring questions: new numbers, not the rulebook examples
    {
        label: "Sushi Go! maki tie",
        question: "Sushi Go, 4 players. Maki roll icons: Anna 4, Ben 4, Cleo 3, Dan 1. How many maki points does everyone get?",
        expected: "Anna 3, Ben 3, Cleo 0, Dan 0 (tie for most splits 6, no second place)",
        tools: ["search_rulebook", "score_sushi_go_round"],
    },
    {
        label: "Sushi Go! puddings, 5 players",
        question: "Sushi Go game end, 5 players. Puddings: Anna 5, Ben 1, Cleo 1, Dan 1, Eva 1. What are the pudding points?",
        expected: "Anna 6, Ben/Cleo/Dan/Eva -1 each (-6 split 4 ways, remainder ignored)",
        tools: ["search_rulebook", "score_sushi_go_puddings"],
    },
    {
        label: "Sushi Go! full round, 2 players",
        question:
            "Sushi Go, 2 players. I have 3 maki roll icons, 3 tempura, 4 sashimi, 4 dumplings, a squid nigiri on wasabi and an egg nigiri. " +
            "My opponent has 1 maki roll icon, 2 tempura, 5 dumplings and a salmon nigiri. What do we each score this round?",
        expected:
            "me 41 (maki 6, tempura 5, sashimi 10, dumplings 10, nigiri 10), opponent 25 (maki 3, tempura 5, dumplings 15, nigiri 2)",
        tools: ["search_rulebook", "score_sushi_go_round"],
    },
    {
        label: "Wizard round",
        question:
            "Wizard: Anna predicted 0 and won 2 tricks, Ben predicted 3 and won 3, Cleo predicted 2 and won 1. How many points does each get this round?",
        expected: "Anna -20, Ben 50, Cleo -10",
        tools: ["search_rulebook", "score_wizard_round"],
    },
    // setup questions with a player count: rulebook search + setup helper
    {
        label: "Azul setup, 3 players",
        question: "We're setting up Azul for 3 players. How many factory displays do we need?",
        expected: "7 factory displays, 4 tiles on each (page 2)",
        tools: ["search_rulebook", "get_player_count_setup"],
    },
    {
        label: "Wizard rounds, 5 players",
        question: "We play Wizard with 5 players. How many rounds do we play?",
        expected: "12 rounds (page 2)",
        tools: ["search_rulebook", "get_player_count_setup"],
    },
    // regression: plain rules questions from step 6, must still work with the score tools connected
    {
        label: "Carcassonne half-built city",
        question: "In Carcassonne, do I get points for a half-built city?",
        expected: "only at game end: 1 per tile + 1 per shield (page 6); completed city 2 + 2 (page 4)",
        tools: ["search_rulebook"],
    },
    {
        label: "Wizard jester",
        question: "Wizard: what happens if I play a jester?",
        expected: "jester loses the trick; if only jesters are played, the first jester wins (page 2)",
        tools: ["search_rulebook"],
    },
    // control: scoring in games without a score tool, answered from the rulebook table
    {
        label: "Azul end-game bonus",
        question:
            "Azul, game end: I have 2 complete horizontal lines, 1 complete vertical line and all 5 tiles of one color. How many bonus points do I get?",
        expected: "21 (2×2 + 7 + 10, page 6)",
        tools: ["search_rulebook"],
    },
    {
        label: "Ticket to Ride route points",
        question: "Ticket to Ride: I claimed a 6-car route and a 4-car route. How many points do they give me?",
        expected: "22 (15 + 7, page 4)",
        tools: ["search_rulebook"],
    },
];

async function main() {
    const summary: { label: string; tools: string; seconds: string }[] = [];

    for (const q of QUESTIONS) {
        console.log(`\n=== ${q.label}: ${q.question}`);
        const start = Date.now();
        const result = await agent.invoke({ messages: [new HumanMessage(q.question)] });
        const seconds = ((Date.now() - start) / 1000).toFixed(1);

        const called = new Set<string>();
        for (const m of result.messages) {
            if (AIMessage.isInstance(m) && m.tool_calls?.length) {
                for (const call of m.tool_calls) {
                    called.add(call.name);
                    console.log("TOOL CALL  ", call.name, JSON.stringify(call.args));
                }
            } else if (ToolMessage.isInstance(m)) {
                console.log("TOOL RESULT", m.text.slice(0, 120).replaceAll("\n", " "), "...");
            }
        }

        const toolsOk = called.size === q.tools.length && q.tools.every((t) => called.has(t));
        console.log(`EXPECTED: ${q.expected}`);
        console.log(`ANSWER (${seconds}s):\n${result.messages.at(-1)?.text}`);
        summary.push({ label: q.label, tools: `${toolsOk ? "ok" : "WRONG"} (${[...called].join(", ") || "none"})`, seconds });
    }

    console.log("\n=== SUMMARY (answers: check against EXPECTED above)");
    console.table(summary);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
