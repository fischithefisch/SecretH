import type { PlayerView } from "../game/view";
import { navigate } from "./nav";
import type { RoomState } from "./useRoom";

/** Same rule as the server: the host decides, or anyone present if the host's own seat is affected. */
function mayDecide(view: PlayerView, seatId: string): boolean {
  const me = view.you?.id;
  const host = view.players.find((p) => p.isHost);
  if (!me || !host) return false;
  return me === host.id || (seatId === host.id && !host.connected);
}

/** Shown to a device that isn't part of a running game. */
export function SeatPicker({ room }: { room: RoomState }) {
  const view = room.view;
  const free = view?.players.filter((p) => p.bot || !p.connected) ?? [];
  const pending = view?.players.find((p) => p.id === room.pendingClaim);

  if (pending) {
    return (
      <div className="panel center">
        <h2>Anfrage gesendet</h2>
        <p>
          Du möchtest den Platz von <b>{pending.name}</b> übernehmen. Der Host muss das auf seinem Handy bestätigen.
        </p>
        <p className="muted small">Lass diese Seite offen.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Spiel läuft bereits</h2>
      {free.length > 0 ? (
        <>
          <p className="muted">
            Wenn du schon mitspielst (z. B. mit neuem Handy) oder für jemanden einspringst, übernimm einen freien Platz.
            Der Host muss zustimmen.
          </p>
          <ul className="lobby-players">
            {free.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name}
                  <span className="badge dim">{p.bot ? "Bot spielt" : "offline"}</span>
                </span>
                <button className="btn small" onClick={() => room.claimSeat(p.id)}>
                  Übernehmen
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">Alle Plätze sind besetzt. Neue Spieler können in der nächsten Runde beitreten.</p>
      )}
      <button className="btn link" onClick={() => navigate("/")}>
        Zur Startseite
      </button>
    </div>
  );
}

/** Seat requests and offline players, for people already in the game. */
export function SeatNotices({ view, room }: { view: PlayerView; room: RoomState }) {
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  const requests = room.claims.filter((c) => mayDecide(view, c.playerId));
  const offline = view.players.filter((p) => !p.bot && !p.connected && p.alive);
  if (requests.length === 0 && offline.length === 0) return null;

  return (
    <div className="notices">
      {requests.map((c) => (
        <section key={c.id} className="panel notice request">
          <p>
            Ein anderes Gerät möchte den Platz von <b>{nameOf(c.playerId)}</b> übernehmen.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => room.resolveClaim(c.id, true)}>
              Erlauben
            </button>
            <button className="btn" onClick={() => room.resolveClaim(c.id, false)}>
              Ablehnen
            </button>
          </div>
        </section>
      ))}
      {offline.map((p) => (
        <section key={p.id} className="panel notice">
          <p>
            <b>{p.name}</b> ist offline. Wenn das Spiel auf diese Person wartet, hängt es, bis sie zurückkommt.
          </p>
          {mayDecide(view, p.id) && (
            <button className="btn small" onClick={() => room.replaceWithBot(p.id)}>
              Durch Bot ersetzen
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
