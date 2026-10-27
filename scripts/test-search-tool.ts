// calls the search tool directly (no LLM): checks the output format the agent will see
import { searchRulebook } from "../src/lib/tools/search-rulebook";

async function main() {
    const result = await searchRulebook.invoke({ query: "incomplete city final scoring", game: "carcassonne" });
    console.log(result);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});