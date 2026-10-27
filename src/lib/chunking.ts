// parses clean rulebook markdown into pieces: one per section per page (used by ingest.ts, unit-tested)
export type Piece = { game: string; section: string; page: number; text: string };

export function parseMarkdown(game: string, markdown: string): Piece[] {
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