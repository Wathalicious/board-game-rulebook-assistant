# Board Game Rulebook Assistant

A chat assistant for the rules of seven board games (Azul, Calico, Carcassonne, Magic Maze, Sushi Go!, Ticket to
Ride, Wizard), meant for use at the table during a game. It answers only from the official rulebooks and cites the
page. Besides rules questions it calculates Sushi Go! and Wizard scores, lists the setup for a given player count,
and suggests which of the seven games fits a group.

## How it works

- **RAG over the rulebooks.** The rulebook PDFs were extracted and cleaned into Markdown (`data/clean/`), split
  into chunks per section and page, embedded and stored in ChromaDB. A question is answered from the retrieved
  passages only, never from the model's own knowledge of the games.
- **An agent with tools.** A LangChain.js agent (`src/lib/agent.ts`) with `gpt-5-mini` via OpenRouter decides which
  tools to call: `search_rulebook` (retrieval), three score tools (Sushi Go! round, Sushi Go! puddings, Wizard round),
  `get_player_count_setup` and `pick_games`. The tool logic is plain TypeScript in `src/lib/` and unit-tested.
- **Next.js app.** The agent runs on the server in a route handler (`POST /api/chat`), so the API key never reaches
  the browser. The page is a chat UI with the seven game tiles, tool-result cards and a source list.

## Setup

Requirements: Node 22, Docker, an [OpenRouter](https://openrouter.ai) API key.

```bash
npm install
```

Create `.env.local` in the project root:

```
OPENROUTER_API_KEY=sk-or-...
CHROMA_URL=http://localhost:8000   # optional, this is the default
```

Start ChromaDB and fill it with the rulebook chunks (the `chroma-data/` volume keeps the embeddings between runs):

```bash
docker run -p 8000:8000 -v ./chroma-data:/data chromadb/chroma
npx tsx --env-file=.env.local scripts/ingest.ts      # data/clean/*.md → 158 chunks → Chroma collection "rulebooks"
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click a game tile or just type a question.

Scripts (all run with `npx tsx --env-file=.env.local scripts/<name>.ts`):

| Script | Purpose |
|---|---|
| `extract.ts` | PDFs in `data/rulebooks/` → raw text in `data/raw/` (only needed to redo the extraction) |
| `ingest.ts` | cleaned Markdown → chunks → embeddings → Chroma |
| `peek.ts` | shows a few stored chunks with their metadata |
| `test-search-tool.ts` | calls the search tool directly, no LLM |
| `test-retrieval.ts`, `test-agent.ts` | evaluation runs, see [Evaluation](#evaluation) |

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

### Setup helper (`src/lib/setup.ts`)

The tool `get_player_count_setup` returns the setup facts that change with the number of players, each with its
rulebook page, e.g. "Azul, 3 players" → 7 Factory displays (page 2). For a player count the game doesn't support it
returns a message instead ("azul is for 2-4 players."), which the agent passes on to the player.

**Why a tool and not only retrieval:** player-count rules are often spread over several sections. Ticket to Ride
explains the setup on page 2, but the rule that only one route of a double route can be claimed with 2 or 3 players
is on page 4, under claiming routes. Wizard lists the number of rounds per player count under "End of the Game", and
the Sushi Go! 2-player pudding rule is under puddings. A search for "setup for 3 players" doesn't reliably return
all of these; the tool collects them in one checked place and returns JSON for the UI. Where one retrieved table
already holds the answer (Azul factory displays), retrieval alone is enough, and the agent sometimes skips the tool
(see [Evaluation](#agent-answers-scriptstest-agentts)). The general setup steps still come from retrieval.

**Data, not code per game:** `SETUP` holds, per game, the player range and a list of facts. A fact without a
`players` list applies to every player count; with one, only to those counts (e.g. the Magic Maze solo deck only for
1 player). Adding a fact is one line of data; `getSetup` only filters the list. `Record<Game, GameSetup>` makes
TypeScript report an error if a game in `GAMES` has no entry.

### Game picker (`src/lib/game-picker.ts`)

The tool `pick_games` answers "which game can we play?": it filters the 7 games by number of players, age of the
youngest player and available play time. All filters are optional; an empty list means no game fits. This can't be
answered by retrieval: every search is filtered to one game, and not every rulebook states its player count.

- **Player count** comes from the setup helper's `SETUP`, so the player ranges exist in one place only.
- **Play time:** a game counts as fitting only if the *upper* value from the box fits (Ticket to Ride, 30–60
  minutes, doesn't fit into 45). Box times are rough, so the filter errs on the safe side.
- **Complexity is not included.** No rulebook rates it, and the available proxies were rejected: the age on the box
  also reflects reading, small parts and theme, not only difficulty, and a personal rating would be an opinion. The
  age is used as what it is, a filter for the youngest player.

**Data sources.** The tools' numbers come from the rulebooks wherever the rulebook states them; the rest is printed on
the game boxes and noted in the code:

| Game | Players | Age | Play time |
|---|---|---|---|
| Azul | 2–4 (setup table, p. 2) | 8+ (box) | 30–45 min (box) |
| Calico | 1–4 (p. 2) | 14+ (p. 2) | 30–45 min (box) |
| Carcassonne | 2–5 (box; not in the rulebook) | 8+ (box) | 30–45 min (box) |
| Magic Maze | 1–8 (components, p. 3) | 8+ (box) | 3–15 min (box) |
| Sushi Go! | 2–5 (setup table, p. 2) | 8+ (box) | 20 min (box) |
| Ticket to Ride | 2–5 (p. 1) | 8+ (p. 1) | 30–60 min (p. 1) |
| Wizard | 3–6 (p. 1) | 10+ (p. 1) | about 45 min (p. 1) |

The Wizard rulebook gives one play time for every player count. Times per player count found online had no
source, so the rulebook's value is used.

### Chat UI (`src/app/`)

The app is a single chat page for desktop use at the game table: dark green ground, bright purple accent,
frosted-glass panels (`src/app/globals.css`). The agent runs on the server behind `POST /api/chat`; the page is a
client component (`src/app/components/chat.tsx`) that keeps the conversation in React state.

- **Game tiles instead of a dropdown.** The start screen shows the seven box covers as glass tiles
  (`public/tiles/`, square crops). A dropdown can be forgotten or contradict the question (dropdown on Azul,
  question about Wizard: which one wins?), and game-picker questions have no game at all. A tile is only a
  shortcut: clicking it puts "Azul: " into the input, and the tile counts as selected exactly while the input starts
  with that prefix. The conversation text is the only thing sent to the agent, so the UI can never disagree with
  the request. Typing without a tile works the same way, and the agent asks which game is meant when the question
  doesn't say. The tiles disappear once the chat starts; "New chat" brings them back.
- **Conversation with history.** The request is `{ messages: [{ role: "user" | "assistant", content }] }`: the
  whole conversation, text only. The route turns it into Human/AI messages for the agent, so follow-up questions
  ("and what about puddings?") keep the game. Earlier tool calls are not replayed; the sources and tool results
  always belong to the current answer.
- **Response: `{ answer, sources, toolResults }`.** `search_rulebook` returns its passages with
  `responseFormat: "content_and_artifact"`: the text goes to the model unchanged, and the artifact holds
  `{ game, section, page }` per passage. The other tools' JSON results are paired with the arguments they were
  called with. A pure function (`src/lib/chat-response.ts`) turns the agent's message list into this response, so
  the extraction is unit-tested without an LLM.
- **Under each answer:** one card per tool result (score tables, setup facts with pages, picked games) and a
  collapsed "Sources" list with game, section and page, so the answer stays short and the evidence is one click
  away. A "Searching the rulebook…" indicator covers the wait; answers are not streamed (see Known Problems).

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
game doesn't support). The game picker tests (`src/lib/game-picker.test.ts`) check each filter on its own and
combined, the edges (a 20-minute game fits into 20 minutes, a 14+ game fits a 14-year-old but not a 13-year-old)
and an empty result. The tool wrappers are tested for their JSON output and for rejecting invalid input
(`src/lib/tools/*.test.ts`). The chat response extraction (`src/lib/chat-response.test.ts`) is tested with
hand-built agent message lists: answer from the last AI message, deduplicated sources from the search tool's
artifact, tool results paired with their call arguments, and the edge cases (no tool calls, non-JSON result,
missing artifact). External
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

The script asks the agent 12 questions and prints every tool call, the tool results, the answer and the time. It
checks automatically whether exactly the expected tools were called. Whether the answer is correct is checked by
reading it against the expected answer, which is verified against the rulebook. The questions:

- **4 scoring questions** for Sushi Go! and Wizard, with new numbers instead of the rulebook's worked examples (the
  retrieved passage already contains the answers to those). They need the rulebook *and* a score tool.
- **2 setup questions** with a player count. They should use the rulebook *and* the setup helper.
- **2 game picker questions** ("which game can we play?"). They are not rules questions, so only the game picker
  should be called, without a rulebook search.
- **2 regression questions**: plain rules questions, which must still work with more tools connected.
- **2 control questions**: scoring in games without a score tool (Azul, Ticket to Ride). The agent should answer
  from the rulebook's table and not call a score tool.

| Question | Expected | 2026-10-28<br>without score tools | 2026-10-29<br>with score tools | 2026-10-29<br>+ setup helper | 2026-10-29<br>+ game picker |
|---|---|---|---|---|---|
| Sushi Go! maki tie (Anna 4, Ben 4, Cleo 3, Dan 1) | 3 / 3 / 0 / 0, no second place | ✅ 9.2 s | ✅ 18.1 s | ✅ 17.8 s | ✅ 16.9 s |
| Sushi Go! puddings, 5 players (5 / 1 / 1 / 1 / 1) | 6 / −1 / −1 / −1 / −1, remainder ignored | ✅ 11.6 s | ✅ 12.7 s | ✅ 15.2 s | ✅ 12.3 s |
| Sushi Go! full round, 2 players, 6 card types | 41 / 25 | ✅ 19.4 s | ✅ 18.9 s | ✅ 26.9 s | ✅ 26.4 s |
| Wizard (predicted→won: 0→2, 3→3, 2→1) | −20 / 50 / −10 | ✅ 9.2 s | ✅ 11.2 s | ✅ 11.2 s | ✅ 12.5 s |
| Azul setup, 3 players: how many factory displays? | 7, with 4 tiles each (page 2) | – | – | ✅ 7.7 s, setup helper not called | ✅ 15.5 s |
| Wizard, 5 players: how many rounds? | 12 (page 2) | – | – | ✅ 9.6 s | ✅ 10.6 s |
| Picker: 5 players, about half an hour | Magic Maze, Sushi Go! | – | – | – | ✅ 10.6 s |
| Picker: 3 players incl. a 9-year-old | Azul, Carcassonne, Magic Maze, Sushi Go!, Ticket to Ride | – | – | – | ✅ 9.8 s |
| Carcassonne: points for a half-built city? | only at game end: 1 per tile + 1 per shield (page 6) | – | ✅ 9.5 s | ✅ 12.1 s | ✅ 9.0 s |
| Wizard: what happens if I play a jester? | always loses, unless only jesters are in the trick (page 2) | – | ✅ 12.1 s | ✅ 11.9 s | ✅ 10.4 s |
| Azul end-game bonus (2 rows, 1 column, 1 colour) | 21 (page 6) | – | ✅ 8.7 s | ✅ 9.6 s | ✅ 9.2 s |
| Ticket to Ride: 6-car + 4-car route | 22 (page 4) | – | ✅ 8.4 s | ✅ 6.6 s | ✅ 6.8 s |
| **Correct answers** | | **4/4** | **8/8** | **10/10** | **12/12** |
| **Expected tools called** | | not checked | **8/8** | **9/10** | **12/12** |
| **Average, 4 scoring questions** | | **12.4 s** | **15.2 s** | **17.8 s** | **17.0 s** |

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
  In the next run the agent did call the setup helper for the same question (15.5 s instead of 7.7 s): tool choice
  itself varies between runs.
- **Game picker:** both questions called only `pick_games`, without a rulebook search, and listed exactly the
  fitting games with "according to the box". The 9-year-old answer added its own suggestions afterwards ("a
  longer, family-friendly route/strategy game"), which go slightly beyond the tool's data.
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

Answers are not streamed: the UI shows a "Searching the rulebook…" indicator and then the whole answer. Streaming
would need a streaming route handler and client; left out for time, since the answers are short.