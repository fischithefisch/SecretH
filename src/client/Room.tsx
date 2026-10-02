import { useEffect, useMemo, useState } from "react";
import { renderSVG } from "uqr";
import { MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS } from "../game/rules";
import type { PlayerView } from "../game/view";
import { GameTable } from "./GameTable";
import { navigate } from "./nav";
import { SeatNotices, SeatPicker } from "./Seats";
import { onSoundChange, setSoundEnabled, soundEnabled } from "./sound";
import { NAME_KEY, storageGet, useRoom, useWakeLock, type RoomState } from "./useRoom";

export function Room({ code }: { code: string }) {
  const room = useRoom(code);
  const { view, needName, status } = room;
  const inGame = !!view?.you && view.phase.kind !== "lobby";
  useWakeLock(inGame);

  let content;
  if (needName) {
    content = needName.gameRunning ? <SeatPicker room={room} /> : <JoinForm room={room} code={code} />;
  } else if (!view || !view.you) {
    content = <p className="center muted">Verbinde …</p>;
  } else if (view.phase.kind === "lobby") {
    content = <Lobby view={view} room={room} code={code} />;
  } else {
    content = (
      <>
        <SeatNotices view={view} room={room} />
        <GameTable view={view} room={room} />
      </>
    );
  }

  return (
    <div className={`screen room ${inGame ? "in-game" : ""}`}>
      <header className="topbar">
        <button className="btn link" onClick={() => navigate("/")} aria-label="Zur Startseite">
          ←
        </button>
        <span className="room-code">Raum {code}</span>
        <span className="row">
          <SoundToggle />
          <span className={`conn conn-${status}`}>
            {status === "open" ? "online" : status === "connecting" ? "verbinde …" : "verbinde neu …"}
          </span>
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
            {n < MAX_PLAYERS && (
              <button className="btn big" onClick={room.addBots}>
                {n < MIN_PLAYERS ? "Mit Bots auffüllen (Testmodus)" : "Einen Bot hinzufügen"}
              </button>
            )}
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

function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  useEffect(() => {
    const off = onSoundChange(setOn);
    return () => {
      off();
    };
  }, []);
  return (
    <button
      className="btn link sound-toggle"
      onClick={() => setSoundEnabled(!on)}
      aria-label={on ? "Ton aus" : "Ton an"}
      title={on ? "Ton aus" : "Ton an"}
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}
