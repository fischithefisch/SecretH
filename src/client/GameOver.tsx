import { motion } from "motion/react";
import type { PlayerView } from "../game/view";
import type { RoomState } from "./useRoom";

export function GameOverPanel({ view, room }: { view: PlayerView; room: RoomState }) {
  if (view.phase.kind !== "gameOver") return null;
  const { winner, reason } = view.phase;
  const me = view.you!;
  const myTeam = me.role === "liberal" ? "liberal" : "fascist";
  return (
    <section className={`panel center gameover ${winner}`}>
      <motion.h1
        className="title small"
        initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.3 }}
      >
        {winner === "liberal" ? "Die Liberalen gewinnen!" : "Die Faschisten gewinnen!"}
      </motion.h1>
      <p>{reason}</p>
      <p className="muted">{myTeam === winner ? "Dein Team hat gewonnen." : "Dein Team hat verloren."}</p>
      {me.isHost ? (
        <button className="btn primary big" onClick={() => room.act({ type: "backToLobby" })}>
          Neue Runde (zur Lobby)
        </button>
      ) : (
        <p className="muted small">Der Host kann eine neue Runde starten.</p>
      )}
    </section>
  );
}
