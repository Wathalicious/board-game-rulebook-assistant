"use client";

// the chat page: start screen with game tiles, then the conversation; talks to /api/chat and shows each answer
// while it is being written (the route streams events, see src/lib/chat-events.ts)
import { useEffect, useRef, useState } from "react";
import { readEvents } from "../../lib/chat-events";
import type { ChatMessage, ChatResponse } from "../../lib/chat-types";
import { GAME_NAMES, GAMES, type Game } from "../../lib/games";
import { Sources, ToolResultCard } from "./answer-extras";
import { GameTiles } from "./game-tiles";
import { ArrowUpIcon, BookIcon, CalculatorIcon, DiceIcon, PeopleIcon, PlusIcon, SpinnerIcon } from "./icons";

// a turn is a chat message; assistant turns also carry what the UI shows under the answer
type Turn = ChatMessage & Partial<Pick<ChatResponse, "sources" | "toolResults">>;

// an answer while it is being written: no signature yet, the server sends that with the finished answer
type Draft = Pick<ChatResponse, "answer" | "sources" | "toolResults">;

const EMPTY_DRAFT: Draft = { answer: "", sources: [], toolResults: [] };

const EXAMPLES = [
  { icon: <PeopleIcon />, text: "We are 3 players and have 2 hours. What can we play?" },
  { icon: <CalculatorIcon />, text: "Wizard: I bid 2 and won 3 tricks. How many points?" },
  { icon: <BookIcon />, text: "Azul: how many factory displays for 3 players?" },
];

// a tile is only a shortcut: it counts as selected exactly when the input starts with its "Game:" prefix
function gameFromInput(value: string): Game | null {
  const lower = value.toLowerCase();
  return GAMES.find((game) => lower.startsWith(`${GAME_NAMES[game].toLowerCase()}:`)) ?? null;
}

// a turn as the API takes it, without what the UI shows under an answer. an assistant turn keeps the signature the
// server gave it, so the route can tell that the turn is its own and not written in the browser
function toChatMessage(turn: Turn): ChatMessage {
  return turn.role === "user"
    ? { role: "user", content: turn.content }
    : { role: "assistant", content: turn.content, signature: turn.signature };
}

function WaitingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm font-semibold text-muted">
      <SpinnerIcon size={16} className="text-accent" />
      <span>{text}</span>
    </div>
  );
}

// an answer: the text, one card per tool result, the collapsed sources. while the answer is still being written,
// a cursor follows the text, and before the first word arrives a waiting line stands in for it
function AnswerBubble({ answer, sources, toolResults, writing = false }: Draft & { writing?: boolean }) {
  return (
    <div className="glass bubble-bot flex max-w-[620px] flex-col gap-3.5 self-start rounded-[18px] rounded-bl-[4px] px-4.5 py-4 leading-relaxed">
      {answer || !writing ? (
        <p className="m-0 whitespace-pre-wrap">
          {answer}
          {writing && <span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] animate-pulse bg-accent" />}
        </p>
      ) : (
        <WaitingLine text={toolResults.length > 0 ? "Writing the answer…" : "Searching the rulebook…"} />
      )}
      {toolResults.map((toolResult, j) => (
        <ToolResultCard key={j} toolResult={toolResult} />
      ))}
      <Sources sources={sources} />
    </div>
  );
}

export function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null); // the answer being written, shown after the turns
  const [input, setInput] = useState("");
  const [lit, setLit] = useState(false); // input pulses once after a tile or example fills it
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = gameFromInput(input);
  const started = turns.length > 0;

  useEffect(() => {
    // smooth for a new turn, instant while the answer is streaming (one scroll per piece of text)
    bottomRef.current?.scrollIntoView({ behavior: draft ? "auto" : "smooth" });
  }, [turns, draft, pending]);

  function fillInput(value: string) {
    setInput(value);
    setLit(value !== "");
    inputRef.current?.focus();
  }

  function pickGame(game: Game) {
    fillInput(selected === game ? "" : `${GAME_NAMES[game]}: `);
  }

  function newChat() {
    setTurns([]);
    setError(null);
    fillInput("");
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) return;

    const history: Turn[] = [...turns, { role: "user", content }];
    setTurns(history);
    setInput("");
    setLit(false);
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // only the conversation goes to the API (role, content, the signature of each assistant turn), not the sources
        // and tool results of earlier answers
        body: JSON.stringify({ messages: history.map(toChatMessage) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `The server answered with status ${response.status}.`);
      }
      if (!response.body) throw new Error("The server sent an empty answer.");

      // the answer arrives as events: pieces of text, the tool results and sources as soon as the tools are done,
      // and finally the finished answer with its signature, which replaces everything shown so far
      let current = EMPTY_DRAFT;
      let finished: ChatResponse | null = null;
      for await (const event of readEvents(response.body)) {
        if (event.type === "text") current = { ...current, answer: current.answer + event.text };
        else if (event.type === "clear") current = { ...current, answer: "" };
        else if (event.type === "tools") current = { ...current, sources: event.sources, toolResults: event.toolResults };
        else if (event.type === "done") finished = event.response;
        else throw new Error(event.error);
        if (!finished) setDraft(current);
      }
      if (!finished) throw new Error("The answer was cut off.");
      setTurns([
        ...history,
        {
          role: "assistant",
          content: finished.answer,
          signature: finished.signature,
          sources: finished.sources,
          toolResults: finished.toolResults,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDraft(null);
      setPending(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 w-full max-w-[1040px] items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <DiceIcon size={26} className="text-accent" />
            <span className="text-lg font-bold tracking-tight">Board Game Rulebook Assistant</span>
          </div>
          {started && (
            <button
              type="button"
              onClick={newChat}
              className="glass flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold hover:bg-white/10"
            >
              <PlusIcon size={16} className="text-accent" />
              <span>New chat</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-4">
          {!started ? (
            <div className="flex flex-1 flex-col justify-center gap-10 py-10">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">Which game are you playing?</h1>
                  <p className="text-muted">Pick a game to ask about its rules, or just type your question below.</p>
                </div>
                <GameTiles selected={selected} onPick={pickGame} />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Or try one of these</p>
                <div className="flex flex-wrap gap-4">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example.text}
                      type="button"
                      onClick={() => fillInput(example.text)}
                      className="glass flex flex-[1_1_280px] cursor-pointer items-center gap-3 rounded-[14px] px-4 py-3.5 text-left text-[15px] font-medium leading-snug transition hover:border-accent/50 hover:bg-white/10"
                    >
                      <span className="flex-none text-accent">{example.icon}</span>
                      <span>{example.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-end gap-3.5 py-6">
              {turns.map((turn, i) =>
                turn.role === "user" ? (
                  <div key={i} className="bubble-user max-w-[520px] self-end rounded-[18px] rounded-br-[4px] px-4.5 py-3 leading-relaxed">
                    {turn.content}
                  </div>
                ) : (
                  <AnswerBubble key={i} answer={turn.content} sources={turn.sources ?? []} toolResults={turn.toolResults ?? []} />
                ),
              )}
              {draft ? (
                <AnswerBubble {...draft} writing />
              ) : (
                pending && (
                  <div className="glass self-start rounded-[18px] rounded-bl-[4px] px-4 py-3">
                    <WaitingLine text="Searching the rulebook…" />
                  </div>
                )
              )}
              {error && (
                <div role="alert" className="self-start rounded-[18px] rounded-bl-[4px] border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm">
                  {error} Please try again.
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10">
        <form onSubmit={send} className="mx-auto flex w-full max-w-[1040px] items-center gap-2.5 px-4 pb-6 pt-4">
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <input
            id="question"
            ref={inputRef}
            type="text"
            autoComplete="off"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setLit(false);
            }}
            placeholder={started ? "Ask a follow-up question…" : "Ask a rules question, or describe your group to get a game suggestion…"}
            className={`glass chat-input h-14 min-w-0 flex-1 rounded-full px-5 text-base font-medium ${lit ? "lit" : ""}`}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={pending || input.trim() === ""}
            className="flex h-14 w-14 flex-none cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_8px_20px_rgba(192,132,252,0.35)] transition hover:bg-accent-soft disabled:cursor-default disabled:opacity-50"
          >
            <ArrowUpIcon size={22} />
          </button>
        </form>
      </footer>
    </div>
  );
}
