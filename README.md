This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Rulebook PDF Download Links

The cleaned Markdown rulebooks in `data/clean/` are in the repository. They are the knowledge base:
`scripts/ingest.ts` reads only these files, so running it rebuilds the Chroma collection without the PDFs. The
PDFs (`data/rulebooks/`) and the raw extracted text (`data/raw/`) are not committed; they are only needed to redo
the extraction with `scripts/extract.ts`. The Markdown files were cleaned up by hand from the raw text, so they
can't be regenerated exactly from it.

Azul:
https://cdn.1j1ju.com/medias/03/14/fd-azul-rulebook.pdf

Calico:
https://www.alderac.com/wp-content/uploads/2025/02/Calico_Rulebook.pdf

Carcassonne:
https://cundco.de/media/db/e5/fa/1715104325/cc-3-0-rules-supplemental.pdf?ts=1773928855

Magic Maze:
https://sitdown-games.com/wp-content/uploads/2018/09/MM_Rules_EN_HR_Sept2018_LD.pdf

SushiGo!:
https://gamewright.com/pdfs/Rules/SushiGoTM-RULES.pdf

Ticket to Ride:
https://cdn.svc.asmodee.net/production-daysofwonder/uploads/2025/07/7201N_TICKET2RIDEV2_RULES_EN_20250425_WEB.pdf

Wizard:
https://blog.amigo-spiele.de/content/ap/rule/06900-GB-AmigoRule.pdf

## Design Decisions

### Chunking (`scripts/ingest.ts`)

The cleaned rulebooks in `data/clean/<game>.md` use `##`/`###` headings and `<!-- page: N -->` markers.
LangChain.js has no Markdown header splitter, so `ingest.ts` uses its own small parser:

1. Walk each file line by line and cut it into **one piece per section per page**. A new heading or a
   page change starts a new piece. Nested headings become `Section > Subsection`.
2. Split only pieces that are too long with `RecursiveCharacterTextSplitter`.
3. Store metadata `{ game, section, page }` with each chunk. `game` comes from the filename and is used
   later to filter searches, so rules from different games don't get mixed up.
4. Prefix each chunk with `<Game> - <Section>` so that the embedding also carries the context.
   Without it, a chunk like "place it in the next free space" doesn't say which game it belongs to.

**Adjusted chunk size after spot-checks.** The first version used `chunkSize: 1000, chunkOverlap: 150`
(201 chunks). Random spot-checks showed sections that were only just over the limit and got split badly:

- Calico "Cat Scoring Tiles" (1027 chars) was split into both cat tables plus a 78-character chunk
  containing only "Shapes of the same pattern that touch each other will not attract another cat." The
  second chunk has no cat names or table, so it is useless on its own.
- Wizard "3. Playing Tricks" (1011 chars) was split so that "Who wins the trick?", one of the most
  important rules, ended up separated from the first half of the section.

Measured section sizes: median ~525 chars, 90th percentile ~1450, max ~2660. So the chunk size was raised to
**`chunkSize: 1500, chunkOverlap: 200`**. About 90% of sections now stay whole, and only the really long
ones are still split (158 chunks in total; median 573 chars, max 1528).
Trade-off: a larger chunk covers more topics, so its embedding is a bit less precise. For rulebook sections
that belong together, keeping them whole matters more.

Remaining weakness: some chunks are very short (minimum 60 chars, e.g. a heading with one sentence). If they
make retrieval noisy, they could be merged into the previous piece.

### Score tools (`src/lib/scoring/`)

The assistant answers rules questions; it does not keep score during a game. But many rules questions are
scoring questions about one concrete situation: "Phil and Amy tie for second place in maki, how many points does
each get?" Answering them needs the rule (retrieval) *and* applying it exactly. The score tools do the applying
in code: `score_sushi_go_round`, `score_sushi_go_puddings` (game end) and `score_wizard_round`.

**Baseline: the model without score tools.** The original reason for the tools was the assumption that an LLM
gets this arithmetic wrong (splitting points, ignoring remainders, forgetting that a tie for first cancels second
place). Before connecting the tools to the agent, this was measured with `scripts/test-agent.ts` on 4 scoring
questions (see [Agent answers](#agent-answers-scriptstest-agentts) under Evaluation). `gpt-5-mini` found the right
rulebook section each time and applied the rule correctly: **4/4, so the assumption was not supported** (one run,
two players at most for the full round).

**Why the tools are kept anyway:**

- **A guaranteed result instead of a probably-correct one.** The model's answers vary between runs and can't be
  unit-tested; the score functions are tested against the rulebooks' own worked examples and always give the same
  result.
- **Harder cases are untested.** 5 players with full hands, or several things to compare at once, give the model
  more room for mistakes than the 2-player round above.
- **Structured results.** The tools return JSON, which the UI can show as a result card; free text can't be shown
  that way.

**With the score tools connected,** all 8 test questions were answered correctly, and the agent picked the right
tools every time: rulebook search plus score tool for the scoring questions, search only for everything else. The
cost is latency: the 4 scoring questions took 15.2 s on average instead of 12.4 s, because the agent can need an
extra round (search, then score tool, then answer). The system prompt tells the agent to still search the rulebook
for scoring questions, so the answer can cite the page of the rule the tool applies.

**Only for Sushi Go! and Wizard.** Tools are built where applying the rule has the most room for error:

- **Sushi Go!:** 6 card types, majorities across players, ties, "ignore the remainder", negative points, a
  2-player exception and wasabi tripling (pages 3–5).
- **Wizard:** a rule with two cases: a correct bid scores 20 + 10 per trick, a wrong bid loses 10 per trick off
  (page 2). Easy to mix up, e.g. points per trick won on a wrong bid, or a bid of 0.

Azul end-game bonuses (+2 per row, +7 per column, +10 per colour) and Ticket to Ride route points (route length →
points) are a simple multiplication or a single table lookup. The retrieved rulebook passage already contains the
table, so retrieval answers them without a tool. Two fully tested tools are worth more than four shallow ones.
Carcassonne and Calico are left out because their scoring depends on the board layout, which a player can't
describe reliably in a chat message; Magic Maze is cooperative and has no points.

**One tool per game**, not one `calculate_score` tool with a `game` parameter: each game needs completely different
inputs (Sushi Go!: card counts of all players; Wizard: bid and tricks won). One combined schema would be easy for
the model to fill in wrong; small tools with clear names and simple schemas are easier to pick and fill.

**Logic and tool are separate.** The scoring rules are pure functions in `src/lib/scoring/<game>.ts`, unit-tested
with the rulebooks' own worked examples (e.g. the maki example on page 3 and the pudding example on page 5). They
need no LLM, API key or Chroma, so they run in CI. The tool in `src/lib/tools/` is only a thin wrapper (zod schema +
description). Adding another game means one scoring file, one test file and one wrapper.

**Interpretation where the rulebook is silent:** Sushi Go! doesn't say whether players with 0 maki icons can take
second place (e.g. 3 / 0 / 0). We decided that 0 icons scores no maki points, since having none isn't "having the
second most".

## Testing

```bash
npm test             # unit tests, run once (Vitest)
npm run test:watch   # unit tests, re-run on save
npm run typecheck    # generate Next.js route types, then tsc --noEmit
npm run lint
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck and the unit tests on every push and pull
request, on Node 22.

**What is tested automatically, and what isn't.** Automated tests cover our own logic: the Markdown parser
(`src/lib/chunking.test.ts`: nested headings, page changes, empty headings, Windows line endings) and the score
functions (`src/lib/scoring/*.test.ts`). The score tests use the rulebooks' own worked examples as test cases
(Sushi Go! maki on page 3 and puddings on page 5, Wizard on page 2), plus edge cases such as ties, remainders
and the 2-player pudding rule. If the code agrees with the publisher's examples, the rule is implemented
correctly. The setup helper tests (`src/lib/setup.test.ts`) check the rulebook tables (Azul factory displays,
Sushi Go! cards per player, Wizard rounds), rules that only apply to some player counts (Ticket to Ride double
routes, solo modes), unsupported player counts, and the setup data itself (e.g. no fact for a player count the
game doesn't support). The tool wrappers are tested for their JSON output and for rejecting invalid input
(`src/lib/tools/*.test.ts`). External
services stay out of CI: there is no Chroma there, and running against OpenRouter would spend API credits on
every push. Retrieval quality and the agent's answers are checked with two evaluation scripts instead (see
[Evaluation](#evaluation)): they need real embeddings, a running Chroma and API credits, and the agent's answers
are non-deterministic, so they can't be pass/fail unit tests.

Test files live next to the code they test (`*.test.ts`). The parser tests use small hand-written Markdown
inputs, not the real rulebooks in `data/clean/`: each input covers exactly one case (e.g. a page change inside
a section), so the expected output is known exactly, and editing a rulebook file can't break a parser test.
The score tests only contain numbers.

## Evaluation

Two scripts evaluate the parts that depend on external services: retrieval on its own, and the whole agent. They
run against the real Chroma collection and OpenRouter, so they are started by hand and not in CI (Chroma has to
be running). Results are recorded in one table per script: one row per question, one column per run, so a change
can be compared with the runs before it. Each column is a single run; the agent's answers vary between runs.

### Retrieval (`scripts/test-retrieval.ts`)

Before any LLM is involved, retrieval is tested on its own. If the chatbot gives a wrong answer later, this
shows whether the problem is retrieval (wrong chunks) or generation (right chunks, wrong answer).

```bash
npx tsx --env-file=.env.local scripts/test-retrieval.ts
```

The script asks real rules questions per game with `similaritySearchWithScore(question, 3, { game })` and
reports a HIT if one of the expected sections is in the top 3. The score is Chroma's squared L2 distance
(lower = more similar). `expected` is a list, because rulebooks often state the same rule in several places:
Carcassonne city points are explained in `Gameplay > Cities` and again in `Summary`.

**Result: 10/11 questions find the right section in the top 3.**

**Vocabulary mismatch.** Retrieval works well when the question uses the rulebook's vocabulary, but misses
colloquial wording:

| Question | Rank of `Game End and Final Scoring` | Best score |
|---|---|---|
| "Do I get points for a half-built city?" | not in top 3 | 0.888 (wrong section) |
| "How are incomplete cities scored at the end of the game?" | 1 | 0.677 |

The rulebook says "incomplete" and puts the rule under game end; the player says "half-built" and doesn't know
where the answer lives. A manually rewritten query moved the correct section from outside the top 3 to rank 1,
which motivates the query-translation step (rewriting questions into rulebook language before retrieval).
The failing question stays in the test set on purpose, as a benchmark that query translation should fix.
This miss is also dangerous: the retrieved chunks give the points for *completed* cities (2 per tile) instead
of final scoring (1 per tile and shield), so the LLM would likely answer wrongly.

Other findings:

- **Weak spots:** for the Azul column bonus and the Ticket to Ride starting cards, the right section is only at
  rank 3 or 2, with almost the same score as the sections above it.
- **Dilution:** Carcassonne `Gameplay > Cities` is mostly about placing tiles, so its embedding barely matches
  a scoring question.
- **No fixed relevance threshold:** good hits range from 0.677 to 1.285, so a rule like "ignore everything above
  1.0" would throw away correct results.
- **Metadata filter:** the `game` filter is applied inside Chroma before ranking, so the top 3 always come from
  the selected game.

### Agent answers (`scripts/test-agent.ts`)

```bash
npx tsx --env-file=.env.local scripts/test-agent.ts
```

The script asks the agent 10 questions and prints every tool call, the tool results, the answer and the time. It
checks automatically whether exactly the expected tools were called. Whether the answer is correct is checked by
reading it against the expected answer, which is verified against the rulebook. The questions:

- **4 scoring questions** for Sushi Go! and Wizard, with new numbers instead of the rulebook's worked examples (the
  retrieved passage already contains the answers to those). They need the rulebook *and* a score tool.
- **2 setup questions** with a player count. They should use the rulebook *and* the setup helper.
- **2 regression questions**: plain rules questions, which must still work with more tools connected.
- **2 control questions**: scoring in games without a score tool (Azul, Ticket to Ride). The agent should answer
  from the rulebook's table and not call a score tool.

| Question | Expected | 2026-10-28<br>without score tools | 2026-10-29<br>with score tools | 2026-10-29<br>+ setup helper |
|---|---|---|---|---|
| Sushi Go! maki tie (Anna 4, Ben 4, Cleo 3, Dan 1) | 3 / 3 / 0 / 0, no second place | ✅ 9.2 s | ✅ 18.1 s | ✅ 17.8 s |
| Sushi Go! puddings, 5 players (5 / 1 / 1 / 1 / 1) | 6 / −1 / −1 / −1 / −1, remainder ignored | ✅ 11.6 s | ✅ 12.7 s | ✅ 15.2 s |
| Sushi Go! full round, 2 players, 6 card types | 41 / 25 | ✅ 19.4 s | ✅ 18.9 s | ✅ 26.9 s |
| Wizard (predicted→won: 0→2, 3→3, 2→1) | −20 / 50 / −10 | ✅ 9.2 s | ✅ 11.2 s | ✅ 11.2 s |
| Azul setup, 3 players: how many factory displays? | 7, with 4 tiles each (page 2) | – | – | ✅ 7.7 s, setup helper not called |
| Wizard, 5 players: how many rounds? | 12 (page 2) | – | – | ✅ 9.6 s |
| Carcassonne: points for a half-built city? | only at game end: 1 per tile + 1 per shield (page 6) | – | ✅ 9.5 s | ✅ 12.1 s |
| Wizard: what happens if I play a jester? | always loses, unless only jesters are in the trick (page 2) | – | ✅ 12.1 s | ✅ 11.9 s |
| Azul end-game bonus (2 rows, 1 column, 1 colour) | 21 (page 6) | – | ✅ 8.7 s | ✅ 9.6 s |
| Ticket to Ride: 6-car + 4-car route | 22 (page 4) | – | ✅ 8.4 s | ✅ 6.6 s |
| **Correct answers** | | **4/4** | **8/8** | **10/10** |
| **Expected tools called** | | not checked | **8/8** | **9/10** |
| **Average, 4 scoring questions** | | **12.4 s** | **15.2 s** | **17.8 s** |

"–": not in the question set yet. The two regression questions were answered correctly when the agent was first
built, before the score tools existed (11.2 s and 12.0 s).

Findings:

- **Tool choice:** right in every case for the score tools. For Azul and Ticket to Ride scoring the agent answered
  from the rulebook's table and did not try to use a Sushi Go! or Wizard score tool.
- **Setup helper skipped for Azul:** for "Azul, 3 players" the agent only searched. The `Game Setup` passage contains
  the factory display table, so the answer was still correct, but the system prompt rule ("also call
  get_player_count_setup") was not followed. Like Azul scoring, a value that sits in one retrieved table doesn't
  need a tool; the setup helper matters for facts spread over several sections (e.g. the Ticket to Ride double
  route rule on page 4, away from the setup on page 2), which the question set doesn't cover yet. Accepted as is:
  forcing the tool call with a stricter prompt would only add a model round for an answer that is already correct.
- **Latency depends on how the tools are called:** when the agent calls search and score tool one after the other
  (maki: 9.2 → 18.1 s, Wizard: 9.2 → 11.2 s), the extra round costs time. When it calls both in the same step
  (puddings, full round), the time hardly changes.
- **Times vary a lot between runs:** the full round took 18.9 s and 26.9 s with the same tools. Single runs only
  show rough trends.
- **Page citations:** in the full round, maki and sashimi are cited from page 7 (the quick game summary) instead
  of their own sections on pages 3–4. The rule is the same, but the main section would be the better source.
- **Half-built city is no evidence for query translation yet:** the agent searched for "incomplete city final
  scoring" (second run: "incomplete city scoring"), which is the example in the `search_rulebook` tool
  description, copied (almost) word for word.

## Known Problems
@langchain/community (used for the Chroma vector store) is deprecated and pulls in optional dependencies (@browserbasehq/stagehand, openai@4) that require zod v3, which conflicts with the project's zod v4.
This is resolved with an npm overrides entry in package.json, since those packages are never used.
(A possible improvement is to replace @langchain/community with the chromadb client directly.)

Answers are slow for use in the middle of a game: about 7–27 s per question (see [Agent answers](#agent-answers-scriptstest-agentts)).
`gpt-5-mini` is a reasoning model, and every question needs at least two model calls (choose the tool, then
answer), three when a score tool is used after the search. Not optimised for lack of time; possible improvements
are a lower reasoning effort, a faster model (a one-line change in `src/lib/llm.ts`, since OpenRouter serves many
models), and shorter tool output.