// the 7 game tiles on the start screen: box cover under glass, pushed in when selected
import Image from "next/image";
import { GAME_NAMES, GAMES, type Game } from "../../lib/games";
import { CheckIcon } from "./icons";

// square crops of the box covers, served from public/tiles/
const TILE_IMAGES: Record<Game, string> = {
  azul: "/tiles/azul.webp",
  calico: "/tiles/calico.webp",
  carcassonne: "/tiles/carcassonne.jpg",
  "magic-maze": "/tiles/magic-maze.webp",
  "sushi-go": "/tiles/sushi-go.jpg",
  "ticket-to-ride": "/tiles/ticket-to-ride.jpg",
  wizard: "/tiles/wizard.jpg",
};

type Props = { selected: Game | null; onPick: (game: Game) => void };

export function GameTiles({ selected, onPick }: Props) {
  return (
    <div className="flex flex-wrap gap-5">
      {GAMES.map((game) => (
        <button
          key={game}
          type="button"
          aria-label={GAME_NAMES[game]}
          aria-pressed={selected === game}
          className={`tile ${selected === game ? "tile-selected" : ""}`}
          onClick={() => onPick(game)}
        >
          <Image src={TILE_IMAGES[game]} alt="" fill sizes="120px" className="object-cover" />
          <span className="tile-check">
            <CheckIcon size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}
