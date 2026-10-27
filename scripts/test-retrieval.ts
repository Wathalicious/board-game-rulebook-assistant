// retrieval test: real rules questions per game -> top-k chunks from chroma (no LLM, only embeddings)
import { getVectorStore } from "../src/lib/vectorstore";

const K = 3;

// expected: sections that answer the question (substring match, any one counts: "Floor Line" matches "Gameplay > Floor Line")
type TestCase = { game: string; question: string; expected: string[] };

const TEST_CASES: TestCase[] = [
    { game: "azul", question: "What happens to tiles I can't place on my pattern lines?", expected: ["Floor Line"] },
    { game: "azul", question: "How many points do I get for a complete column?", expected: ["End of the Game"] },
    { game: "calico", question: "How do I get a button?", expected: ["Button Scoring Tile + Button Tokens"] },
    { game: "carcassonne", question: "How many points is a finished city worth?", expected: ["Cities", "Summary"] },
    { game: "carcassonne", question: "Do I get points for a half-built city?", expected: ["Game End and Final Scoring"] },
    { game: "magic-maze", question: "Can we talk during the game?", expected: ["Communication Restriction"] },
    { game: "sushi-go", question: "How does wasabi work with nigiri?", expected: ["Nigiri and Wasabi", "Using Wasabi"] },
    { game: "ticket-to-ride", question: "How many points for a route of length 4?", expected: ["Route Scoring"] },
    { game: "ticket-to-ride", question: "How many cards do I get at the beginning of the game?", expected: ["Setting Up the Game"] },
    { game: "wizard", question: "What happens if I play a jester?", expected: ["Wizards and Jesters"] },
];

async function main() {
    const store = getVectorStore();
    let hits = 0;

    for (const tc of TEST_CASES) {
        // filter: only search chunks of this game
        const results = await store.similaritySearchWithScore(tc.question, K, { game: tc.game });
        const hit = results.some(([doc]) => tc.expected.some((e) => String(doc.metadata.section).includes(e)));
        if (hit) hits++;

        console.log(`\n${hit ? "HIT " : "MISS"} [${tc.game}] ${tc.question}  (expected: ${tc.expected.join(" | ")})`);
        for (const [doc, score] of results) {
            // L2 distance: lower = more similar
            console.log(`  ${score.toFixed(3)}  p.${doc.metadata.page}  ${doc.metadata.section}`);
        }
    }
    console.log(`\n${hits}/${TEST_CASES.length} questions found the expected section in the top ${K}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});