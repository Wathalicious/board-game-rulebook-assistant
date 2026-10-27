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

### Retrieval test (`scripts/test-retrieval.ts`)

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
(`src/lib/chunking.test.ts`: nested headings, page changes, empty headings, Windows line endings). External
services stay out of CI: there is no Chroma there, and running against OpenRouter would spend API credits on
every push. Retrieval quality is checked manually with `scripts/test-retrieval.ts` (see above), because it
needs real embeddings and is an evaluation rather than a pass/fail unit test. The agent's final answers are
not unit-tested, because they are non-deterministic.

Test files live next to the code they test (`*.test.ts`). The tests use small hand-written Markdown inputs,
not the real rulebooks, so the expected output is known exactly and the tests don't depend on `data/clean/`
(which is gitignored).

## Known Problems
@langchain/community (used for the Chroma vector store) is deprecated and pulls in optional dependencies (@browserbasehq/stagehand, openai@4) that require zod v3, which conflicts with the project's zod v4.
This is resolved with an npm overrides entry in package.json, since those packages are never used.
(A possible improvement is to replace @langchain/community with the chromadb client directly.)