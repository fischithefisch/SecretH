import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Policy } from "../game/types";
import type { PlayerView } from "../game/view";
import { policyImg } from "./assets";
import { STAMP_DELAY } from "./Board";
import { CardBack } from "./FlipCard";
import { sfx } from "./sound";

interface Pt {
  x: number;
  y: number;
}
interface Flight {
  id: number;
  from: Pt;
  to: Pt;
  delay: number;
}
interface Reveal {
  id: number;
  policy: Policy;
  chaos: boolean;
  from: Pt;
  to: Pt;
}
interface Banner {
  id: number;
  text: string;
  tone: "good" | "bad" | "neutral";
}

let nextId = 1;

function anchor(name: string): Pt | null {
  const el = document.querySelector(`[data-anchor="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function shake(selector: string, strength = 6) {
  const el = document.querySelector(selector);
  el?.animate(
    [
      { transform: "translate(0,0)" },
      { transform: `translate(${-strength}px, ${strength / 2}px)` },
      { transform: `translate(${strength}px, ${-strength / 2}px)` },
      { transform: `translate(${-strength / 2}px, 0)` },
      { transform: "translate(0,0)" },
    ],
    { duration: 420, easing: "ease-out" },
  );
}

/**
 * Plays table animations and sounds by comparing each new game view with the
 * previous one. Purely cosmetic: everything shown is already public.
 */
export function Fx({ view }: { view: PlayerView }) {
  const prev = useRef<PlayerView | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [flash, setFlash] = useState<{ id: number; color: string } | null>(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!p || p.gameNumber !== view.gameNumber) {
      // First render or a new game: only the deal is animated.
      if (p && view.phase.kind === "roleReveal") deal(view);
      return;
    }
    const v = view;
    const fly = (from: string | null, to: string | null, count: number, delay = 0) => {
      const a = from && anchor(from);
      const b = to && anchor(to);
      if (!a || !b) return;
      const add: Flight[] = Array.from({ length: count }, (_, i) => ({
        id: nextId++,
        from: a,
        to: b,
        delay: delay + i * 0.09,
      }));
      setFlights((f) => [...f, ...add]);
    };
    const say = (text: string, tone: Banner["tone"] = "neutral") => setBanner({ id: nextId++, text, tone });
    const seat = (id: string | null) => (id ? `seat-${id}` : null);

    if (p.phase.kind === "lobby" && v.phase.kind === "roleReveal") deal(v);

    // Vote result
    if (v.lastVote && v.lastVote.seq !== p.lastVote?.seq) {
      const votes = Object.values(v.lastVote.votes);
      const ja = votes.filter(Boolean).length;
      votes.forEach((_, i) => sfx.flip(i * 0.04));
      say(
        `${v.lastVote.passed ? "Regierung gewählt" : "Wahl gescheitert"} · ${ja} Ja / ${votes.length - ja} Nein`,
        v.lastVote.passed ? "good" : "bad",
      );
    }

    // President draws three policies
    if (p.phase.kind !== "presidentDiscard" && v.phase.kind === "presidentDiscard") {
      fly("deck", seat(v.presidentId), 3, 0.3);
      sfx.slide(0.3);
    }
    // President passes two to the chancellor, discards one
    if (p.phase.kind === "presidentDiscard" && v.phase.kind === "chancellorEnact") {
      fly(seat(v.presidentId), seat(v.chancellorId), 2);
      fly(seat(v.presidentId), "discard", 1, 0.15);
      sfx.slide();
    }
    // Veto accepted: both cards go to the discard pile
    if (p.phase.kind === "vetoProposed" && v.phase.kind !== "chancellorEnact") {
      fly(seat(p.chancellorId), "discard", 2);
      say("Veto! Beide Gesetze abgelegt", "neutral");
      sfx.slide();
    }

    // A policy was enacted
    if (v.lastEnacted && v.lastEnacted.seq !== p.lastEnacted?.seq) {
      const { policy, chaos } = v.lastEnacted;
      const from = chaos ? anchor("deck") : anchor(seat(p.chancellorId) ?? "deck");
      const to = anchor(policy === "L" ? "board-L" : "board-F");
      if (!chaos && p.phase.kind === "chancellorEnact") fly(seat(p.chancellorId), "discard", 1);
      if (from && to) setReveal({ id: nextId++, policy, chaos, from, to });
      sfx.flip(0.6);
      sfx.stamp(STAMP_DELAY);
      if (chaos) {
        say("Chaos! Das Volk ist frustriert", "bad");
        shake(".table-wrap", 8);
        setFlash({ id: nextId++, color: "rgba(232, 96, 63, 0.45)" });
        sfx.rumble();
      }
      setTimeout(() => shake(policy === "L" ? '[data-anchor="board-L"]' : '[data-anchor="board-F"]', 3), STAMP_DELAY * 1000 + 80);
    }

    // Reshuffle
    if (v.deckCount > p.deckCount && v.phase.kind !== "roleReveal") {
      fly("discard", "deck", Math.min(6, v.deckCount - p.deckCount), 2.4);
      setTimeout(() => sfx.shuffle(), 2400);
    }

    // Executions
    for (const pl of v.players) {
      const before = p.players.find((x) => x.id === pl.id);
      if (before?.alive && !pl.alive) {
        setFlash({ id: nextId++, color: "rgba(255, 255, 255, 0.85)" });
        shake(`[data-anchor="seat-${pl.id}"]`, 10);
        shake(".table-wrap", 4);
        say(`${pl.name} wurde hingerichtet`, "bad");
        sfx.shot();
      }
    }

    // Special election / investigation announcements
    if (p.phase.kind === "power" && p.phase.power === "specialElection" && v.phase.kind === "nominate") {
      say(`Sonderwahl: ${v.players.find((x) => x.id === v.presidentId)?.name} ist Präsident`, "neutral");
    }
    if (v.phase.kind === "power" && v.phase.investigatedId && !(p.phase.kind === "power" && p.phase.investigatedId)) {
      const nameOf = (id: string | null) => v.players.find((x) => x.id === id)?.name ?? "?";
      say(`${nameOf(v.presidentId)} prüft die Parteikarte von ${nameOf(v.phase.investigatedId)}`, "neutral");
      sfx.flip();
    }

    // Game over
    if (p.phase.kind !== "gameOver" && v.phase.kind === "gameOver") {
      const myTeam = v.you?.role === "liberal" ? "liberal" : "fascist";
      v.players.forEach((_, i) => sfx.flip(0.4 + i * 0.25));
      setTimeout(() => sfx.fanfare(v.phase.kind === "gameOver" && v.phase.winner === myTeam), 600);
    }

    // It's my turn now
    const myTurn = (x: PlayerView) => {
      const me = x.you?.id;
      if (!me) return false;
      switch (x.phase.kind) {
        case "nominate":
        case "presidentDiscard":
        case "power":
        case "vetoProposed":
          return x.presidentId === me;
        case "chancellorEnact":
          return x.chancellorId === me;
        case "vote":
          return !!x.you?.alive && x.myVote === null;
        default:
          return false;
      }
    };
    if (!myTurn(p) && myTurn(v)) setTimeout(() => sfx.chime(), 500);

    function deal(x: PlayerView) {
      const ids = x.players.map((pl) => pl.id);
      const center = anchor("deck");
      if (!center) return;
      const add: Flight[] = ids.flatMap((id, i) => {
        const to = anchor(`seat-${id}`);
        return to ? [{ id: nextId++, from: center, to, delay: 0.2 + i * 0.12 }] : [];
      });
      setFlights((f) => [...f, ...add]);
      sfx.deal(ids.length);
    }
  }, [view]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2600);
    return () => clearTimeout(t);
  }, [banner]);

  return (
    <div className="fx-layer" aria-hidden>
      {flights.map((f) => (
        <motion.div
          key={f.id}
          className="fx-card"
          style={{ left: f.from.x - 13, top: f.from.y - 18 }}
          initial={{ x: 0, y: 0, rotate: -20, opacity: 0, scale: 0.8 }}
          animate={{ x: f.to.x - f.from.x, y: f.to.y - f.from.y, rotate: 8, opacity: [0, 1, 1, 0], scale: 1 }}
          transition={{ duration: 0.7, delay: f.delay, ease: "easeInOut", opacity: { times: [0, 0.1, 0.85, 1], duration: 0.7, delay: f.delay } }}
          onAnimationComplete={() => setFlights((all) => all.filter((x) => x.id !== f.id))}
        >
          <CardBack />
        </motion.div>
      ))}

      {reveal && (
        <RevealCard key={reveal.id} reveal={reveal} onDone={() => setReveal((r) => (r?.id === reveal.id ? null : r))} />
      )}

      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            className={`fx-banner ${banner.tone}`}
            initial={{ opacity: 0, scale: 0.6, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>

      {flash && (
        <motion.div
          key={flash.id}
          className="fx-flash"
          style={{ background: flash.color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, times: [0, 0.1, 1] }}
          onAnimationComplete={() => setFlash(null)}
        />
      )}
    </div>
  );
}

const CARD_W = 120;
const CARD_H = 161;

/** The enacted policy: rises from the chancellor (or the deck), turns over, then lands on the board. */
function RevealCard({ reveal, onDone }: { reveal: Reveal; onDone: () => void }) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.42;
  const times = [0, 0.22, 0.42, 0.78, 1];
  const duration = STAMP_DELAY + 0.05;
  return (
    <motion.div
      className="fx-reveal"
      style={{ left: -CARD_W / 2, top: -CARD_H / 2 }}
      initial={{ x: reveal.from.x, y: reveal.from.y, scale: 0.25, opacity: 0 }}
      animate={{
        x: [reveal.from.x, cx, cx, cx, reveal.to.x],
        y: [reveal.from.y, cy, cy, cy, reveal.to.y],
        scale: [0.25, 1, 1.08, 1, 0.22],
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{ duration, times, ease: "easeInOut" }}
      onAnimationComplete={onDone}
    >
      <motion.div
        className="fx-reveal-inner"
        initial={{ rotateY: 180 }}
        animate={{ rotateY: [180, 180, 0, 0, 0] }}
        transition={{ duration, times }}
      >
        <div className="flip-face flip-front">
          <img src={policyImg(reveal.policy)} alt="" />
        </div>
        <div className="flip-face flip-back">
          <CardBack />
        </div>
      </motion.div>
      {reveal.chaos && <div className="fx-reveal-label">Chaos</div>}
    </motion.div>
  );
}
