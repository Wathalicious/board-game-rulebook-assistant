import { getVectorStore } from "../src/lib/vectorstore";

async function main() {
    const collection = await getVectorStore().ensureCollection();
    console.log("Total chunks:", await collection.count());

    // Get a few chunks of one game, filtered by metadata (no embedding involved)
    const result = await collection.get({ where: { game: "azul" }, limit: 3 });
    result.ids.forEach((id, i) => {
        console.log("\n---", id, result.metadatas[i]);
        console.log(result.documents[i]?.slice(0, 300));
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});