import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { COLLECTION_NAME, getVectorStore, resetCollection } from "../src/lib/vectorstore";

const INPUT_DIR = "data/clean";

type Piece = { game: string; section: string; page: number; text: string };
type Chunk = { text: string; metadata: { game: string; section: string; page: number } };

function parseMarkdown(game: string, markdown: string): Piece[] {
    const pieces: Piece[] = [];
    let h2 = "";
    let h3 = "";
    let page = 1;
    let buffer: string[] = [];
    
    const flush = () => {
        const text = buffer.join("\n").trim();
        if (text) {
            const section = h3 ? `${h2} > ${h3}` : h2;
            pieces.push({ game, section, page, text });
        }
        buffer = [];
    };
    for (const line of markdown.split(/\r?\n/)) {
        const pageMatch = line.match(/^<!-- page: (\d+) -->$/);
        if (pageMatch) {
            const newPage = Number(pageMatch[1]);
            if (newPage !== page) {
                flush();
                page = newPage;
            }
            continue;
        }
        if (line.startsWith("## ")) {
            flush();
            h2 = line.slice(3).trim();
            h3 = "";
            continue;
        }
        if (line.startsWith("### ")) {
            flush();
            h3 = line.slice(4).trim();
            continue;
        }
        if (line.startsWith("# ")) continue;
        buffer.push(line);
    }
    flush();
    return pieces;
}

async function main() {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 200 });
    const files = (await readdir(INPUT_DIR)).filter((f) => f.endsWith(".md"));
    const allChunks: Chunk[] = [];

    for (const file of files) {
        const game = file.replace(".md", "");
        const markdown = await readFile(path.join(INPUT_DIR, file), "utf-8");
        const title = markdown.match(/^# (.+)$/m)?.[1] ?? game;
        const pieces = parseMarkdown(game, markdown);

        for (const piece of pieces) {
            const parts = await splitter.splitText(piece.text);
            for (const part of parts) {
                allChunks.push({
                    text: `${title} - ${piece.section}\n\n${part}`,
                    metadata: { game: piece.game, section: piece.section, page: piece.page },
                });
            }
        }
        const count = allChunks.filter((c) => c.metadata.game === game).length;
        console.log(`${game}: ${pieces.length} pieces -> ${count} chunks`);
    }
    const lengths = allChunks.map((c) => c.text.length).sort((a, b) => a - b);
    console.log(`\nTotal: ${allChunks.length} chunks`);
    console.log(`Length min ${lengths[0]}, median ${lengths[Math.floor(lengths.length / 2 )]}, max ${lengths[lengths.length - 1]}`);

     // Spot-check: a few random chunks with their metadata
    for (let i = 0; i < 3; i++) {
        const chunk = allChunks[Math.floor(Math.random() * allChunks.length)];
        console.log("\n---", chunk.metadata);
        console.log(chunk.text.slice(0, 300));
    }

    // Store in Chroma: rebuild the collection from scratch on every run
    await resetCollection();
    const store = getVectorStore();
    const docs = allChunks.map((c) => new Document({ pageContent: c.text, metadata: c.metadata }));
    const ids = allChunks.map((c, i) => `${c.metadata.game}-${i}`);
    await store.addDocuments(docs, { ids });

    const collection = await store.ensureCollection();
    console.log(`\nStored ${await collection.count()} chunks in Chroma collection "${COLLECTION_NAME}"`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});