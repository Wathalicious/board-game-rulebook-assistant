// sushi go! scoring (rules in data/clean/sushi-go.md, pages 3–5); pure functions, no LLM, unit-tested
export type Nigiri = { squid: number; salmon: number; egg: number };

const DUMPLING_POINTS = [0, 1, 3, 6, 10, 15];

export function scoreTempura(count: number) {
    return Math.floor(count / 2) * 5;
}

export function scoreSashimi(count: number) {
    return Math.floor(count / 3) * 10;
}

export function scoreDumplings(count: number) {
    return DUMPLING_POINTS[Math.min(count, 5)];
}

function nigiriValue(n: Nigiri) {
    return n.squid * 3 + n.salmon * 2 + n.egg * 1;
}

export function scoreNigiri(plain: Nigiri, onWasabi: Nigiri) {
    return nigiriValue(plain) + nigiriValue(onWasabi) * 3;
}

function split(points: number, players: number) {
    return Math.trunc(points / players);
}

function playersWith(values: number[], target: number) {
    return values.flatMap((v, i) => (v === target ? [i] : []));
}

export function scoreMaki(icons: number[]) {
    const points = icons.map(() => 0);
    const most = Math.max(...icons);
    if (most === 0) return points;

    const first = playersWith(icons, most);
    for (const i of first) points[i] = split(6, first.length);
    if (first.length > 1) return points;

    const secondMost = Math.max(0, ...icons.filter((n) => n < most));
    if (secondMost === 0) return points;
    const second = playersWith(icons, secondMost);
    for (const i of second) points[i] = split(3, second.length);
    return points;
}

export function scorePuddings(counts: number[]) {
    const points = counts.map(() => 0);
    const most = Math.max(...counts);
    const fewest = Math.min(...counts);
    if (most === fewest) return points;

    const top = playersWith(counts, most);
    for (const i of top) points[i] += split(6, top.length);

    if (counts.length > 2) {
        const bottom = playersWith(counts, fewest);
        for (const i of bottom) points[i] += split(-6, bottom.length);
    }
    return points;
}