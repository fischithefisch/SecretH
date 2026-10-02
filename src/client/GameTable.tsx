import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { PlayerView } from "../game/view";
import { ActionPanel, describeStatus, hasActionPanel, PickContext, pickTargets } from "./Actions";
import { Board } from "./Board";
import { CardBack, FlipCard } from "./FlipCard";
import { Fx } from "./Fx";
import { GameOverPanel } from "./GameOver";
import { useHold } from "./Hold";
import { RoleInfo } from "./RoleReveal";
import { Table } from "./Table";
import type { RoomState } from "./useRoom";

export function GameTable({ view, room }: { view: PlayerView; room: RoomState }) {
  const status = describeStatus(view);
  const [zoom, setZoom] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const over = view.phase.kind === "gameOver";
  const sheetOpen = over || hasActionPanel(view);
  const [picked, setPicked] = useState<string | null>(null);
  const power = view.phase.kind === "power" ? view.phase.power : "";
  const pickKey = `${view.phase.kind}-${view.presidentId}-${power}`;
  useEffect(() => setPicked(null), [pickKey]);
  const targets = pickTargets(view);

  useEffect(() => {
    document.title = status.mine ? "● Du bist dran – Secret Hitler" : "Secret Hitler";
  }, [status.mine]);

  return (
    <PickContext.Provider value={{ picked, setPicked }}>
    <div className="game">
      <motion.div
        key={status.text}
        className={`status ${status.mine ? "mine" : ""}`}
        role="status"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {status.text}
      </motion.div>

      <Table view={view} onZoom={() => setZoom(true)} selectable={targets} picked={picked} onPick={setPicked} />

      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            key="sheet"
            className="sheet"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
          >
            {over ? <GameOverPanel view={view} room={room} /> : <ActionPanel view={view} room={room} />}
          </motion.div>
        )}
      </AnimatePresence>

      <HandBar view={view} onLog={() => setLogOpen(true)} />
      <Fx view={view} />

      <AnimatePresence>
        {zoom && (
          <motion.div
            className="overlay zoom"
            onClick={() => setZoom(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }} className="zoom-box">
              <Board view={view} />
              <p className="muted small center">Tippen zum Schließen</p>
            </motion.div>
          </motion.div>
        )}
        {logOpen && <LogDrawer view={view} onClose={() => setLogOpen(false)} />}
      </AnimatePresence>
    </div>
    </PickContext.Provider>
  );
}

/** Your own spot at the table: hold your role card to look at it. */
function HandBar({ view, onLog }: { view: PlayerView; onLog: () => void }) {
  const hold = useHold();
  const canPeek = view.phase.kind !== "roleReveal" && !!view.you?.role;
  return (
    <>
      <AnimatePresence>
        {hold.active && canPeek && (
          <motion.div
            className="overlay role-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <RoleInfo view={view} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="handbar">
        <button className="hand-role" disabled={!canPeek} {...hold.handlers}>
          <FlipCard flipped={false} front={null} back={<CardBack />} className="hand-card" />
          <span>{hold.active ? "Loslassen" : "Rolle (halten)"}</span>
        </button>
        <button className="btn small" onClick={onLog}>
          Verlauf
        </button>
      </div>
    </>
  );
}

function LogDrawer({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  return (
    <motion.div className="overlay drawer-bg" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Spielverlauf</h2>
          <button className="btn small" onClick={onClose}>
            Schließen
          </button>
        </div>
        <ol>
          {[...view.log].reverse().map((e, i) => (
            <li key={`${e.seq}-${i}`}>{e.text}</li>
          ))}
        </ol>
      </motion.div>
    </motion.div>
  );
}
