//connection to chroma, shared by ingest, peek and later the retrieval test and API route
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { embeddings } from "./llm";

export const COLLECTION_NAME = "rulebooks";
const CHROMA_URL = new URL(process.env.CHROMA_URL ?? "http://localhost:8000");

const client = new ChromaClient({
    host: CHROMA_URL.hostname,
    port: Number(CHROMA_URL.port),
    ssl: CHROMA_URL.protocol === "https:",
});

export function getVectorStore() {
    return new Chroma(embeddings, { collectionName: COLLECTION_NAME, index: client });
}

// deletes the collection so a re-run of the ingest script starts from scratch
export async function resetCollection() {
    const collections = await client.listCollections();
    if (collections.some((c) => c.name === COLLECTION_NAME)) {
        await client.deleteCollection({ name: COLLECTION_NAME });
    }
}