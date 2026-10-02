import { motion, useAnimationControls } from "motion/react";
import { useEffect, useRef } from "react";
import { boardName } from "../game/rules";
import type { PlayerView } from "../game/view";
import { IMG } from "./assets";

// Tile positions on the board artwork (percent of the board width).
const LIB_FIRST = 18.2;
const FAS_FIRST = 11;
const TILE_STEP_LIB = 13.54;
const TILE_STEP_FAS = 13.6;
/** New tiles land after the big "policy enacted" reveal has played. */
export const STAMP_DELAY = 1.9;

/** Remembers the count from the previous render, so only fresh tiles animate. */
function usePrevious(value: number): number {
  const ref = useRef(value);
  const prev = ref.current;
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return prev;
}

function Track(props: {
  count: number;
  src: string;
  tile: string;
  first: number;
  step: number;
  anchor: string;
  alt: string;
  children?: React.ReactNode;
}) {
  const prev = usePrevious(props.count);
  const shake = useAnimationControls();
  useEffect(() => {
    if (props.count > prev) {
      void shake.start({
        x: [0, -4, 4, -2, 0],
        transition: { delay: STAMP_DELAY + 0.12, duration: 0.3 },
      });
    }
  }, [props.count, prev, shake]);

  return (
    <motion.div className="board-group" data-anchor={props.anchor} animate={shake}>
      <img className="board-img" src={props.src} alt={props.alt} draggable={false} />
      {Array.from({ length: props.count }, (_, i) => {
        const fresh = i >= prev;
        return (
          <motion.img
            key={i}
            className="tile"
            src={props.tile}
            alt=""
            draggable={false}
            style={{ left: `${props.first + i * props.step}%` }}
            initial={fresh ? { scale: 2.6, opacity: 0, rotate: -14, y: "-30%" } : false}
            animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
            transition={{ delay: fresh ? STAMP_DELAY : 0, type: "spring", stiffness: 520, damping: 20 }}
          />
        );
      })}
      {props.children}
    </motion.div>
  );
}

export function Board({ view, compact = false }: { view: PlayerView; compact?: boolean }) {
  const board = boardName(view.players.length);
  return (
    <section className={`board ${compact ? "compact" : ""}`}>
      <Track
        count={view.liberalPolicies}
        src={IMG.boardLiberal}
        tile={IMG.tileLiberal}
        first={LIB_FIRST}
        step={TILE_STEP_LIB}
        anchor="board-L"
        alt={`${view.liberalPolicies} von 5 liberalen Gesetzen erlassen`}
      >
        <img
          className="tracker"
          src={IMG.tracker}
          alt={`Wahl-Tracker: ${view.electionTracker} von 3`}
          style={{ left: `${34.2 + view.electionTracker * 9.16}%` }}
          draggable={false}
        />
      </Track>
      <Track
        count={view.fascistPolicies}
        src={IMG.boardFascist[board]}
        tile={IMG.tileFascist}
        first={FAS_FIRST}
        step={TILE_STEP_FAS}
        anchor="board-F"
        alt={`${view.fascistPolicies} von 6 faschistischen Gesetzen erlassen`}
      />
      {!compact && (
        <p className="board-info">
          <span>Stapel: {view.deckCount}</span>
          <span>Ablage: {view.discardCount}</span>
          <span>Gescheiterte Wahlen: {view.electionTracker}/3</span>
          {view.config && view.fascistPolicies >= view.config.vetoFrom && <span>Veto freigeschaltet</span>}
        </p>
      )}
    </section>
  );
}
