import { useEffect, useMemo, useState } from "react";
import { renderSVG } from "uqr";
import { MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS } from "../game/rules";
import type { PlayerView } from "../game/view";
import { ActionPanel, describeStatus } from "./Actions";
import { Board } from "./Board";
import { GameOver } from "./GameOver";
import { navigate } from "./nav";
import { Events } from "./Events";
import { RoleButton } from "./RoleReveal";
import { NAME_KEY, storageGet, useRoom, useWakeLock, type RoomState } from "./useRoom";

export function Room({ code }: { code: string }) {
  const room = useRoom(code);
  const { view, needName, status } = room;
  const inGame = !!view?.you && view.phase.kind !== "lobby";
  useWakeLock(inGame);

  let content;
  if (needName) {
    content = needName.gameRunning ? <GameRunning /> : <JoinForm room={room} code={code} />;
  } else if (!view || !view.you) {
    content = <p className="center muted">Verbinde …</p>;
  } else if (view.phase.kind === "lobby") {
    content = <Lobby view={view} room={room} code={code} />;
  } else if (view.phase.kind === "gameOver") {
    content = <GameOver view={view} room={room} />;
  } else {
    content = <Game view={view} room={room} />;
  }

  return (
    <div className="screen room">
      <header className="topbar">
        <button className="btn link" onClick={() => navigate("/")} aria-label="Zur Startseite">
          ←
        </button>
        <span className="room-code">Raum {code}</span>
        <span className={`conn conn-${status}`}>
          {status === "open" ? "online" : status === "connecting" ? "verbinde …" : "verbinde neu …"}
        </span>
      </header>
      <ErrorToast error={room.error} />
      {content}
    </div>
  );
}

function ErrorToast({ error }: { error: RoomState["error"] }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!error) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [error]);
  if (!error || !visible) return null;
  return (
    <div className="toast" role="alert" onClick={() => setVisible(false)}>
      {error.message}
    </div>
  );
}

function GameRunning() {
  return (
    <div className="panel center">
      <h2>Spiel läuft bereits</h2>
      <p className="muted">In diesem Raum wird gerade gespielt. Neue Spieler können erst in der nächsten Runde beitreten.</p>
      <button className="btn" onClick={() => navigate("/")}>
        Zur Startseite
      </button>
    </div>
  );
}

function JoinForm({ room, code }: { room: RoomState; code: string }) {
  const [name, setName] = useState(() => storageGet(NAME_KEY) ?? "");
  const [sent, setSent] = useState(false);
  useEffect(() => setSent(false), [room.error]);
  const trimmed = name.trim();
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        setSent(true);
        room.join(trimmed);
      }}
    >
      <h2>Raum {code} beitreten</h2>
      <label htmlFor="name">Dein Name</label>
      <input
        id="name"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => setName(e.target.value)}
        autoComplete="nickname"
        autoFocus
      />
      <button className="btn primary big" disabled={!trimmed || sent}>
        Beitreten
      </button>
    </form>
  );
}

function Lobby({ view, room, code }: { view: PlayerView; room: RoomState; code: string }) {
  const you = view.you!;
  const n = view.players.length;
  const url = `${location.origin}/${code}`;
  const qr = useMemo(() => renderSVG(url, { border: 1 }), [url]);
  const [showQr, setShowQr] = useState(false);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Secret Hitler", text: `Komm in Raum ${code}:`, url });
        return;
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard?.writeText(url).catch(() => {});
    }
  };

  return (
    <div className="lobby">
      <section className="panel center">
        <p className="muted">Raumcode</p>
        <p className="big-code">{code}</p>
        <div className="row center">
          <button className="btn" onClick={share}>
            Link teilen
          </button>
          <button className="btn" onClick={() => setShowQr((s) => !s)}>
            {showQr ? "QR ausblenden" : "QR-Code"}
          </button>
        </div>
        {showQr && <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />}
      </section>

      <section className="panel">
        <h2>
          Spieler ({n}/{MAX_PLAYERS})
        </h2>
        <ul className="lobby-players">
          {view.players.map((p) => (
            <li key={p.id} className={p.connected ? "" : "offline"}>
              <span>
                {p.name}
                {p.id === you.id && " (du)"}
                {p.isHost && <span className="badge">Host</span>}
                {!p.connected && <span className="badge dim">offline</span>}
              </span>
              {you.isHost && p.id !== you.id && (
                <button className="btn small" onClick={() => room.act({ type: "kick", targetId: p.id })}>
                  Entfernen
                </button>
              )}
            </li>
          ))}
        </ul>
        {you.isHost ? (
          <>
            <button
              className="btn primary big"
              disabled={n < MIN_PLAYERS}
              onClick={() => room.act({ type: "start" })}
            >
              Spiel starten
            </button>
            {n < MIN_PLAYERS && <p className="muted center">Noch {MIN_PLAYERS - n} Spieler nötig.</p>}
          </>
        ) : (
          <p className="muted center">Warte, bis der Host das Spiel startet …</p>
        )}
        <button
          className="btn link danger"
          onClick={() => {
            room.act({ type: "leave" });
            room.forgetSeat();
            navigate("/");
          }}
        >
          Raum verlassen
        </button>
      </section>
    </div>
  );
}

function Game({ view, room }: { view: PlayerView; room: RoomState }) {
  const status = describeStatus(view);
  useEffect(() => {
    document.title = status.mine ? "● Du bist dran – Secret Hitler" : "Secret Hitler";
  }, [status.mine]);

  return (
    <div className="game">
      <div className={`status ${status.mine ? "mine" : ""}`} role="status">
        {status.text}
      </div>
      <ActionPanel view={view} room={room} />
      <Board view={view} />
      <PlayerList view={view} />
      <Log view={view} />
      <RoleButton view={view} />
      <Events view={view} />
    </div>
  );
}

function PlayerList({ view }: { view: PlayerView }) {
  return (
    <section className="panel">
      <h2>Spieler</h2>
      <ul className="players">
        {view.players.map((p) => {
          const voting = view.phase.kind === "vote";
          const tags: string[] = [];
          if (p.id === view.presidentId) tags.push("Präsident");
          if (p.id === view.chancellorId) tags.push(voting ? "Kanzler?" : "Kanzler");
          return (
            <li key={p.id} className={`${p.alive ? "" : "dead"} ${p.connected ? "" : "offline"}`}>
              <span className="pname">
                {p.name}
                {p.id === view.you?.id && " (du)"}
              </span>
              <span className="ptags">
                {tags.map((t) => (
                  <span key={t} className={`badge ${t === "Präsident" ? "pres" : "chan"}`}>
                    {t}
                  </span>
                ))}
                {!p.alive && <span className="badge dead">tot</span>}
                {p.confirmedNotHitler && <span className="badge">kein Hitler</span>}
                {p.investigated && <span className="badge dim">untersucht</span>}
                {view.phase.kind === "vote" && p.alive && (
                  <span className={`badge ${p.hasVoted ? "ok" : "dim"}`}>{p.hasVoted ? "✓ gewählt" : "…"}</span>
                )}
                {!p.connected && <span className="badge dim">offline</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Log({ view }: { view: PlayerView }) {
  const [open, setOpen] = useState(false);
  const entries = [...view.log].reverse();
  return (
    <section className="panel log">
      <button className="btn link" onClick={() => setOpen((o) => !o)}>
        {open ? "Spielverlauf ausblenden" : "Spielverlauf anzeigen"}
      </button>
      {open && (
        <ol>
          {entries.map((e, i) => (
            <li key={`${e.seq}-${i}`}>{e.text}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
