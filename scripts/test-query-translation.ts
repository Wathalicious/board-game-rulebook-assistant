// query translation test (step 8): does the agent's own search query find the right section better than the raw question?
// per colloquial question: rank of the expected section for the raw question (Chroma only), the query the agent sends to
// search_rulebook, and the rank for that query. no DeepEval, no judge: section match is a substring check on metadata.
import { AIMessage, HumanMessage } from "langchain";
import { agent } from "../src/lib/agent";
import { getVectorStore } from "../src/lib/vectorstore";

const K = 4; // same as the search tool

// expected: sections that answer the question (substring match, any one counts)
type TestCase = { game: string; question: string; expected: string[] };

// colloquial wording, as players ask at the table, not the rulebook's terms; none of these appear in the tool description
const TEST_CASES: TestCase[] = [
    { game: "carcassonne", question: "Carcassonne: do I get points for a half-built city?", expected: ["Game End and Final Scoring"] },
    { game: "azul", question: "Azul: I filled a whole column on my wall, is that worth anything?", expected: ["End of the Game"] },
    { game: "azul", question: "Azul: what if I pick up tiles that don't fit anywhere?", expected: ["Floor Line"] },
    { game: "ticket-to-ride", question: "Ticket to Ride: what do we each start with in our hand?", expected: ["Setting Up the Game"] },
    { game: "wizard", question: "Wizard: what happens if I guessed wrong?", expected: ["Earning Experience Points"] },
    { game: "sushi-go", question: "Sushi Go: can I put a second nigiri on the same wasabi?", expected: ["Using Wasabi", "Nigiri and Wasabi"] },
    { game: "magic-maze", question: "Magic Maze: the sand timer ran out, did we lose?", expected: ["Time Restriction"] },
    { game: "calico", question: "Calico: what happens when my board is full?", expected: ["Game End + Final Scoring"] },
];

// rank (1-based) of the first expected section in the top K, or "MISS"; also the top section for context
async function rank(query: string, tc: TestCase): Promise<{ rank: string; top: string }> {
    const results = await getVectorStore().similaritySearchWithScore(query, K, { game: tc.game });
    const index = results.findIndex(([doc]) => tc.expected.some((e) => String(doc.metadata.section).includes(e)));
    const [topDoc, topScore] = results[0] ?? [];
    const top = topDoc ? `${String(topDoc.metadata.section)} (${topScore.toFixed(3)})` : "nothing";
    return { rank: index === -1 ? "MISS" : String(index + 1), top };
}

async function main() {
    const summary: { question: string; rawRank: string; agentQuery: string; agentRank: string; seconds: string }[] = [];
    let rawHits = 0;
    let agentHits = 0;

    for (const tc of TEST_CASES) {
        console.log(`\n=== [${tc.game}] ${tc.question}  (expected: ${tc.expected.join(" | ")})`);

        // 1. raw question straight to chroma
        const raw = await rank(tc.question, tc);
        console.log(`RAW QUESTION  rank ${raw.rank}, top: ${raw.top}`);

        // 2. the query the agent writes itself (all search_rulebook calls, usually one)
        const start = Date.now();
        const result = await agent.invoke({ messages: [new HumanMessage(tc.question)] });
        const seconds = ((Date.now() - start) / 1000).toFixed(1);
        const queries: string[] = [];
        for (const m of result.messages) {
            if (!AIMessage.isInstance(m)) continue;
            for (const call of m.tool_calls ?? []) {
                if (call.name === "search_rulebook") queries.push(String(call.args.query));
            }
        }

        // 3. the agent's query straight to chroma
        const agentRanks: string[] = [];
        for (const q of queries) {
            const r = await rank(q, tc);
            agentRanks.push(r.rank);
            console.log(`AGENT QUERY   '${q}' → rank ${r.rank}, top: ${r.top}`);
        }
        if (queries.length === 0) console.log("AGENT QUERY   none (search_rulebook not called)");
        console.log(`ANSWER (${seconds}s):\n${result.messages.at(-1)?.text}`);

        if (raw.rank !== "MISS") rawHits++;
        if (agentRanks.some((r) => r !== "MISS")) agentHits++;
        summary.push({
            question: tc.question,
            rawRank: raw.rank,
            agentQuery: queries.join(" | ") || "none",
            agentRank: agentRanks.join(" | ") || "-",
            seconds,
        });
    }

    console.log(`\n=== SUMMARY: raw question ${rawHits}/${TEST_CASES.length}, agent query ${agentHits}/${TEST_CASES.length} in the top ${K}`);
    console.table(summary);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
