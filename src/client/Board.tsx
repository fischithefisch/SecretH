import { boardName } from "../game/rules";
import type { PlayerView } from "../game/view";
import { IMG } from "./assets";

// Tile positions on the board artwork (percent of the board width).
const LIB_FIRST = 18.2;
const FAS_FIRST = 11;
const TILE_STEP_LIB = 13.54;
const TILE_STEP_FAS = 13.6;

export function Board({ view }: { view: PlayerView }) {
  const board = boardName(view.players.length);
  return (
    <section className="board">
      <div className="board-group">
        <img
          className="board-img"
          src={IMG.boardLiberal}
          alt={`${view.liberalPolicies} von 5 liberalen Gesetzen erlassen`}
        />
        {Array.from({ length: view.liberalPolicies }, (_, i) => (
          <img key={i} className="tile" src={IMG.tileLiberal} alt="" style={{ left: `${LIB_FIRST + i * TILE_STEP_LIB}%` }} />
        ))}
        <img
          className="tracker"
          src={IMG.tracker}
          alt={`Wahl-Tracker: ${view.electionTracker} von 3`}
          style={{ left: `${34.2 + view.electionTracker * 9.16}%` }}
        />
      </div>
      <div className="board-group">
        <img
          className="board-img"
          src={IMG.boardFascist[board]}
          alt={`${view.fascistPolicies} von 6 faschistischen Gesetzen erlassen`}
        />
        {Array.from({ length: view.fascistPolicies }, (_, i) => (
          <img key={i} className="tile" src={IMG.tileFascist} alt="" style={{ left: `${FAS_FIRST + i * TILE_STEP_FAS}%` }} />
        ))}
      </div>
      <p className="board-info">
        <span>Stapel: {view.deckCount}</span>
        <span>Ablage: {view.discardCount}</span>
        <span>Gescheiterte Wahlen: {view.electionTracker}/3</span>
        {view.config && view.fascistPolicies >= view.config.vetoFrom && <span>Veto freigeschaltet</span>}
      </p>
    </section>
  );
}
