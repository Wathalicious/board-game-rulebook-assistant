// what an answer carries besides the text: tool result cards and the collapsible source list
import { useState } from "react";
import type { Source, ToolResult } from "../../lib/chat-types";
import { GAME_NAMES, type Game } from "../../lib/games";
import { BookIcon, CalculatorIcon, ChevronIcon, DiceIcon, PeopleIcon } from "./icons";

const TOOL_LABELS: Record<string, string> = {
  score_sushi_go_round: "Score calculator · Sushi Go! round",
  score_sushi_go_puddings: "Score calculator · Sushi Go! puddings",
  score_wizard_round: "Score calculator · Wizard round",
  get_player_count_setup: "Setup helper",
  pick_games: "Game picker",
};

function gameName(value: unknown) {
  return typeof value === "string" && value in GAME_NAMES ? GAME_NAMES[value as Game] : String(value);
}

// "minPlayers" → "Min players"
function label(key: string) {
  const words = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toolIcon(tool: string) {
  if (tool === "get_player_count_setup") return <PeopleIcon size={16} />;
  if (tool === "pick_games") return <DiceIcon size={16} />;
  return <CalculatorIcon size={16} />;
}

// one line describing the call, e.g. "Azul · 3 players" or "5 players · up to 30 min"
function describeArgs(tool: string, args: Record<string, unknown>) {
  const parts: string[] = [];
  if (tool === "get_player_count_setup") {
    parts.push(gameName(args.game), `${args.players} players`);
  } else if (tool === "pick_games") {
    if (args.players !== undefined) parts.push(`${args.players} players`);
    if (args.youngestAge !== undefined) parts.push(`youngest ${args.youngestAge}`);
    if (args.maxMinutes !== undefined) parts.push(`up to ${args.maxMinutes} min`);
  }
  return parts.join(" · ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// a list of objects (score results, picked games) becomes a table with one column per key
function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr className="text-left">
            {keys.map((key) => (
              <th key={key} className="px-2 py-1.5 font-bold first:pl-0 last:pr-0">
                {label(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {keys.map((key) => (
                <td key={key} className="px-2 py-1.5 first:pl-0 last:pr-0">
                  {key === "game" ? gameName(row[key]) : String(row[key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultBody({ result }: { result: unknown }) {
  if (Array.isArray(result)) {
    if (result.length === 0) return <p className="m-0 text-[15px]">No game fits these filters.</p>;
    if (result.every(isRecord)) return <ResultTable rows={result} />;
  }
  if (isRecord(result)) {
    if (typeof result.error === "string") return <p className="m-0 text-[15px]">{result.error}</p>;
    if (Array.isArray(result.facts)) {
      return (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-[18px] text-[15px]">
          {result.facts.map((fact, i) => (
            <li key={i}>
              {String(fact.text)} <span className="text-muted">(p. {String(fact.page)})</span>
            </li>
          ))}
        </ul>
      );
    }
  }
  return <pre className="m-0 whitespace-pre-wrap text-sm">{typeof result === "string" ? result : JSON.stringify(result, null, 2)}</pre>;
}

export function ToolResultCard({ toolResult }: { toolResult: ToolResult }) {
  const { tool, args, result } = toolResult;
  const detail = describeArgs(tool, args);
  return (
    <div className="tool-card flex flex-col gap-2 rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-accent-soft">
        {toolIcon(tool)}
        <span>
          {TOOL_LABELS[tool] ?? tool}
          {detail && ` · ${detail}`}
        </span>
      </div>
      <ResultBody result={result} />
    </div>
  );
}

// collapsed by default, so the answer stays short at the table
export function Sources({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;
  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1.5 font-semibold text-muted hover:text-fg"
      >
        <ChevronIcon open={open} size={14} />
        <span>Sources ({sources.length})</span>
      </button>
      {open && (
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
          {sources.map((s) => (
            <li
              key={`${s.game}-${s.section}-${s.page}`}
              className="flex items-center gap-2 rounded-[10px] border border-white/10 px-2.5 py-2"
            >
              <BookIcon size={16} className="flex-none text-muted" />
              <span className="font-semibold">{GAME_NAMES[s.game] ?? s.game}</span>
              <span className="text-muted">
                · {s.section} · p. {s.page}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
