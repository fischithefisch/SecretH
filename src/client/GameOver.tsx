import type { PlayerView } from "../game/view";
import { ROLE_LABEL, roleImg } from "./assets";
import { Board } from "./Board";
import type { RoomState } from "./useRoom";

export function GameOver({ view, room }: { view: PlayerView; room: RoomState }) {
  if (view.phase.kind !== "gameOver") return null;
  const { winner, reason } = view.phase;
  const me = view.you!;
  const myTeam = me.role === "liberal" ? "liberal" : "fascist";
  return (
    <div className="gameover">
      <section className={`panel center banner ${winner}`}>
        <h1 className="title small">{winner === "liberal" ? "Die Liberalen gewinnen!" : "Die Faschisten gewinnen!"}</h1>
        <p>{reason}</p>
        <p className="muted">{myTeam === winner ? "Dein Team hat gewonnen." : "Dein Team hat verloren."}</p>
      </section>
      <section className="panel">
        <h2>Alle Rollen</h2>
        <ul className="reveal-grid">
          {view.players.map((p) => {
            const role = view.knownRoles[p.id];
            return (
              <li key={p.id} className={p.alive ? "" : "dead"}>
                {role && <img src={roleImg(role, p.id)} alt="" />}
                <span>
                  <b>{p.name}</b>
                  <br />
                  {role ? ROLE_LABEL[role] : "?"}
                  {!p.alive && " (tot)"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <Board view={view} />
      <section className="panel center">
        {me.isHost ? (
          <button className="btn primary big" onClick={() => room.act({ type: "backToLobby" })}>
            Neue Runde (zur Lobby)
          </button>
        ) : (
          <p className="muted">Der Host kann eine neue Runde starten.</p>
        )}
      </section>
    </div>
  );
}
