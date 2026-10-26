// PDF → raw text per page: data/rulebooks/*.pdf → data/raw/<game>.txt
import { write } from "node:fs";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

const INPUT_DIR = "data/rulebooks";
const OUTPUT_DIR = "data/raw";

async function extractPdf(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    try {
        const result = await parser.getText();
        return result.pages
            .map((page) => `=== PAGE ${page.num} ===\n${page.text.trim()}`)
            .join("\n\n");
    } finally {
        await parser.destroy();
    }
}

async function main() {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const files = (await readdir(INPUT_DIR)).filter((f) => f.endsWith(".pdf"));

    for (const file of files) {
        const game = file.replace("-rules.pdf", "");
        const text = await extractPdf(path.join(INPUT_DIR, file));
        await writeFile(path.join(OUTPUT_DIR, `${game}.txt`), text, "utf-8");
        console.log(`${game}: ${text.length} characters`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});