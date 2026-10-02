import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlayerView } from "../game/view";
import { IMG, portraitMap, ROLE_LABEL, roleImg } from "./assets";
import { Board } from "./Board";
import { CardBack, FlipCard } from "./FlipCard";
import { ellipseSeats, rotateToViewer } from "./seatLayout";

const SEAT_SIZES = { normal: { w: 66, h: 80 }, small: { w: 58, h: 70 } };

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Ids of the people the game is waiting for right now. */
export function waitingFor(v: PlayerView): Set<string> {
  const ids = new Set<string>();
  const add = (id: string | null) => id && ids.add(id);
  switch (v.phase.kind) {
    case "roleReveal":
      v.players.filter((p) => !p.seenRole).forEach((p) => ids.add(p.id));
      break;
    case "nominate":
    case "presidentDiscard":
    case "vetoProposed":
    case "power":
      add(v.presidentId);
      break;
    case "chancellorEnact":
      add(v.chancellorId);
      break;
    case "vote":
      v.players.filter((p) => p.alive && !p.hasVoted).forEach((p) => ids.add(p.id));
      break;
  }
  return ids;
}

/** Votes stay visible on the table for a while after they were revealed. */
function useVisibleVotes(v: PlayerView): PlayerView["lastVote"] {
  const [recent, setRecent] = useState<number | null>(null);
  const seq = v.lastVote?.seq ?? null;
  const first = useRef(seq);
  useEffect(() => {
    if (seq === null || seq === first.current) return;
    setRecent(seq);
    const t = setTimeout(() => setRecent(null), 6500);
    return () => clearTimeout(t);
  }, [seq]);
  const legislative = ["presidentDiscard", "chancellorEnact", "vetoProposed"].includes(v.phase.kind);
  return v.lastVote && (recent === v.lastVote.seq || legislative) ? v.lastVote : null;
}

export function Table(props: {
  view: PlayerView;
  onZoom: () => void;
  /** Seats that can be tapped right now (nomination, powers). */
  selectable: string[] | null;
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const { view, onZoom, selectable, picked, onPick } = props;
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const crowded = view.players.length >= 8;
  const { w: SEAT_W, h: SEAT_H } = crowded ? SEAT_SIZES.small : SEAT_SIZES.normal;
  const seats = rotateToViewer(view.players, view.you?.id);
  const portraits = useMemo(() => portraitMap(view.players.map((p) => p.id)), [view.players]);
  const positions = w ? ellipseSeats(seats.length, w / 2, h / 2, w / 2 - SEAT_W / 2, h / 2 - SEAT_H / 2) : [];
  const waiting = waitingFor(view);
  const votes = useVisibleVotes(view);
  const over = view.phase.kind === "gameOver";
  // Centre area: the largest box (aspect ~1:1) that fits inside the ring of seats.
  const a = Math.max(1, w / 2 - SEAT_W * 0.95);
  const b = Math.max(1, h / 2 - SEAT_H * 0.9);
  const k = 1.1;
  const halfH = 1 / Math.sqrt((k / a) ** 2 + 1 / b ** 2);
  const centerW = 2 * k * halfH;
  const centerH = 2 * halfH;
  const insetX = (w - centerW) / 2;
  const insetY = (h - centerH) / 2;
  const BOARD_RATIO = 1200 / 463;
  const boardW = Math.max(0, Math.min(centerW, ((centerH - 40) / 2) * BOARD_RATIO));

  return (
    <div className={`table-wrap ${crowded ? "crowded" : ""}`} ref={ref}>
      <div className="table-top" />
      <div className="table-center" style={{ inset: `${insetY}px ${insetX}px` }}>
        <button
          className="board-button"
          style={{ width: boardW }}
          onClick={onZoom}
          aria-label="Spielbrett vergrößern"
        >
          <Board view={view} compact />
        </button>
        <div className="piles" style={{ width: boardW }}>
          <Pile anchor="deck" label="Stapel" count={view.deckCount} />
          <div className="tracker-pill" title="Gescheiterte Wahlen">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < view.electionTracker ? "on" : ""} />
            ))}
          </div>
          <Pile anchor="discard" label="Ablage" count={view.discardCount} />
        </div>
      </div>

      {positions.length > 0 &&
        seats.map((p, i) => {
          const { x, y } = positions[i];
          const vote = votes?.votes[p.id];
          const canPick = !!selectable?.includes(p.id);
          const role = over ? view.knownRoles[p.id] : undefined;
          return (
            <div
              key={p.id}
              className={[
                "seat",
                p.alive ? "" : "dead",
                p.connected ? "" : "offline",
                waiting.has(p.id) && !selectable ? "waiting" : "",
                p.id === view.you?.id ? "me" : "",
                canPick ? "selectable" : selectable ? "unselectable" : "",
                picked === p.id ? "picked" : "",
              ].join(" ")}
              style={{ left: x, top: y, width: SEAT_W, height: SEAT_H }}
              data-anchor={`seat-${p.id}`}
              onClick={canPick ? () => onPick(p.id) : undefined}
            >
              <div className="portrait">
                <img src={portraits[p.id]} alt="" draggable={false} />
                {!p.alive && <span className="skull">☠</span>}
                {role && (
                  <FlipCard
                    flipped
                    delay={0.25 * i}
                    className="seat-role"
                    front={<img src={roleImg(role, p.id)} alt={ROLE_LABEL[role]} />}
                  />
                )}
              </div>
              <span className="seat-name">{p.id === view.you?.id ? "Du" : p.name.replace(/ \(Bot\)$/, "")}</span>
              {p.bot && <span className="bot-tag">Bot</span>}
              <div className="placards">
                {p.id === view.presidentId && !over && (
                  <motion.span layoutId="placard-president" className="placard pres">
                    Präsident
                  </motion.span>
                )}
                {p.id === view.chancellorId && !over && (
                  <motion.span layoutId="placard-chancellor" className="placard chan">
                    {view.phase.kind === "vote" ? "Kanzler?" : "Kanzler"}
                  </motion.span>
                )}
                {p.confirmedNotHitler && <span className="placard tag">kein Hitler</span>}
              </div>
              {!p.connected && <span className="offline-dot" title="offline" />}
              <AnimatePresence>
                {(vote !== undefined || (view.phase.kind === "vote" && p.hasVoted)) && (
                  <motion.div
                    key={`vote-${votes?.seq ?? "open"}`}
                    className="seat-vote"
                    style={{ left: SEAT_W / 2 + 22, top: -2 }}
                    initial={{ opacity: 0, scale: 0.4, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  >
                    <FlipCard
                      flipped={vote !== undefined}
                      front={<img src={vote ? IMG.ja : IMG.nein} alt={vote ? "Ja" : "Nein"} />}
                      back={<CardBack />}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
    </div>
  );
}

function Pile({ anchor, label, count }: { anchor: string; label: string; count: number }) {
  return (
    <div className="pile" data-anchor={anchor}>
      <div className="pile-stack">
        {Array.from({ length: Math.min(3, Math.ceil(count / 4)) }, (_, i) => (
          <div key={i} className="pile-card" style={{ transform: `translate(${i * 2}px, ${-i * 2}px)` }}>
            <CardBack />
          </div>
        ))}
        {count === 0 && <div className="pile-empty" />}
      </div>
      <span className="pile-label" aria-label={`${label}: ${count}`}>
        {count}
      </span>
    </div>
  );
}
