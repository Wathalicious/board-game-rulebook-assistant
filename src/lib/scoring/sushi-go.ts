// sushi go! scoring (rules in data/clean/sushi-go.md, pages 3–5); pure functions, no LLM, unit-tested

export type Nigiri = { squid: number; salmon: number; egg: number };

// index = number of dumplings: 1 / 2 / 3 / 4 / 5+ → 1 / 3 / 6 / 10 / 15 (page 4)
const DUMPLING_POINTS = [0, 1, 3, 6, 10, 15];

// set of 2 = 5 points, a single one is worth nothing (page 4)
export function scoreTempura(count: number) {
    return Math.floor(count / 2) * 5;
}

// set of 3 = 10 points (page 4)
export function scoreSashimi(count: number) {
    return Math.floor(count / 3) * 10;
}

export function scoreDumplings(count: number) {
    return DUMPLING_POINTS[Math.min(count, 5)];
}

function nigiriValue(n: Nigiri) {
    return n.squid * 3 + n.salmon * 2 + n.egg * 1;
}

// nigiri on wasabi count triple (page 4); a wasabi without nigiri scores nothing, so it isn't an input
export function scoreNigiri(plain: Nigiri, onWasabi: Nigiri) {
    return nigiriValue(plain) + nigiriValue(onWasabi) * 3;
}

// split points evenly among tied players, ignoring any remainder (pages 3 and 5)
function split(points: number, players: number) {
    return Math.trunc(points / players);
}

// indexes of all players who have exactly `target`
function playersWith(values: number[], target: number) {
    return values.flatMap((v, i) => (v === target ? [i] : []));
}

// maki icons of all players → maki points of all players, same order (page 3)
// our interpretation (rulebook is silent): players with 0 icons score no maki points
export function scoreMaki(icons: number[]) {
    const points = icons.map(() => 0);
    const most = Math.max(...icons);
    if (most === 0) return points;

    const first = playersWith(icons, most);
    for (const i of first) points[i] = split(6, first.length);
    if (first.length > 1) return points; // tie for most: no second place

    const secondMost = Math.max(0, ...icons.filter((n) => n < most));
    if (secondMost === 0) return points;
    const second = playersWith(icons, secondMost);
    for (const i of second) points[i] = split(3, second.length);
    return points;
}

// pudding cards of all players at game end → pudding points of all players, same order (page 5)
export function scorePuddings(counts: number[]) {
    const points = counts.map(() => 0);
    const most = Math.max(...counts);
    const fewest = Math.min(...counts);
    if (most === fewest) return points; // all tied: nobody scores

    const top = playersWith(counts, most);
    for (const i of top) points[i] += split(6, top.length);

    if (counts.length > 2) { // 2 players: nobody loses points
        const bottom = playersWith(counts, fewest);
        for (const i of bottom) points[i] += split(-6, bottom.length);
    }
    return points;
}

export type SushiGoPlayer = {
    name: string;
    makiIcons: number;
    tempura: number;
    sashimi: number;
    dumplings: number;
    nigiri: Nigiri;
    nigiriOnWasabi: Nigiri;
};

// one round: points per card type and total for every player, same order as the input
// maki compares players, so a single player gets no maki points (nobody to compare with)
export function scoreRound(players: SushiGoPlayer[]) {
    const maki = players.length > 1 ? scoreMaki(players.map((p) => p.makiIcons)) : [0];

    return players.map((p, i) => {
        const points = {
            maki: maki[i],
            tempura: scoreTempura(p.tempura),
            sashimi: scoreSashimi(p.sashimi),
            dumplings: scoreDumplings(p.dumplings),
            nigiri: scoreNigiri(p.nigiri, p.nigiriOnWasabi),
        };
        const total = Object.values(points).reduce((sum, n) => sum + n, 0);
        return { name: p.name, ...points, total };
    });
}