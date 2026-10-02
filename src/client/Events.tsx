import { useEffect, useRef, useState } from "react";
import type { PlayerView } from "../game/view";
import { IMG, policyImg } from "./assets";

type Event =
  | { kind: "vote"; seq: number; vote: NonNullable<PlayerView["lastVote"]> }
  | { kind: "policy"; seq: number; enacted: NonNullable<PlayerView["lastEnacted"]> };

/**
 * Pops up the public moments everyone should notice: the vote reveal and each
 * enacted policy. Events from before this page loaded are not replayed.
 */
export function Events({ view }: { view: PlayerView }) {
  const seenSeq = useRef<number>(view.seq);
  const [queue, setQueue] = useState<Event[]>([]);

  useEffect(() => {
    const fresh: Event[] = [];
    if (view.lastVote && view.lastVote.seq > seenSeq.current) {
      fresh.push({ kind: "vote", seq: view.lastVote.seq, vote: view.lastVote });
    }
    if (view.lastEnacted && view.lastEnacted.seq > seenSeq.current) {
      fresh.push({ kind: "policy", seq: view.lastEnacted.seq, enacted: view.lastEnacted });
    }
    seenSeq.current = Math.max(seenSeq.current, view.seq);
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [view]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), current.kind === "vote" ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  const close = () => setQueue((q) => q.slice(1));
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";

  if (current.kind === "vote") {
    const { vote } = current;
    return (
      <div className="overlay event" onClick={close}>
        <div className="event-box">
          <h2>{vote.passed ? "Regierung gewählt" : "Wahl gescheitert"}</h2>
          <p className="muted">
            {nameOf(vote.presidentId)} (Präsident) &amp; {nameOf(vote.chancellorId)} (Kanzler)
          </p>
          <ul className="vote-list">
            {Object.entries(vote.votes).map(([id, ja]) => (
              <li key={id}>
                <img src={ja ? IMG.ja : IMG.nein} alt={ja ? "Ja" : "Nein"} />
                <span>{nameOf(id)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Tippen zum Schließen</p>
        </div>
      </div>
    );
  }

  const { enacted } = current;
  return (
    <div className="overlay event" onClick={close}>
      <div className="event-box">
        <h2>
          {enacted.chaos ? "Chaos! " : ""}
          {enacted.policy === "L" ? "Liberales" : "Faschistisches"} Gesetz erlassen
        </h2>
        <img className="policy-card large" src={policyImg(enacted.policy)} alt="" />
        {enacted.chaos && <p className="muted">Drei gescheiterte Wahlen: Das oberste Gesetz wurde erlassen.</p>}
        <p className="muted small">Tippen zum Schließen</p>
      </div>
    </div>
  );
}
