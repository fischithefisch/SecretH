import { useEffect, useState } from "react";
import type { PlayerView } from "../game/view";
import { ROLE_LABEL, roleImg } from "./assets";
import { HoldToShow } from "./Hold";

/** Your role, your team (if you know it) and what you learned by investigating. */
function RoleInfo({ view }: { view: PlayerView }) {
  const me = view.you!;
  const role = me.role!;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  const others = Object.entries(view.knownRoles).filter(([id]) => id !== me.id);
  const fascists = others.filter(([, r]) => r === "fascist").map(([id]) => nameOf(id));
  const hitler = others.find(([, r]) => r === "hitler");
  const investigations = Object.entries(view.knownParties);

  return (
    <div className="role-info">
      <img className="role-card" src={roleImg(role, me.id)} alt={`Deine Rolle: ${ROLE_LABEL[role]}`} />
      <p className="role-name">Du bist {ROLE_LABEL[role]}</p>
      {role === "liberal" && <p>Finde und stoppe Hitler. Die Liberalen gewinnen mit 5 liberalen Gesetzen.</p>}
      {role === "fascist" && (
        <p>
          {hitler && (
            <>
              Hitler ist <b>{nameOf(hitler[0])}</b>.{" "}
            </>
          )}
          {fascists.length > 0 ? (
            <>
              Weitere Faschisten: <b>{fascists.join(", ")}</b>.
            </>
          ) : (
            "Du bist der einzige Faschist neben Hitler."
          )}
        </p>
      )}
      {role === "hitler" &&
        (fascists.length > 0 ? (
          <p>
            Deine Faschisten: <b>{fascists.join(", ")}</b>.
          </p>
        ) : (
          <p>Du weißt nicht, wer die Faschisten sind – aber sie kennen dich.</p>
        ))}
      {investigations.length > 0 && (
        <p className="small">
          Untersucht:{" "}
          {investigations
            .map(([id, party]) => `${nameOf(id)} ist ${party === "liberal" ? "liberal" : "faschistisch"}`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

/** Used during the role reveal phase. */
export function RoleCardHold({ view }: { view: PlayerView }) {
  return (
    <HoldToShow
      hidden={<div className="role-back">Deine geheime Rolle</div>}
      shown={<RoleInfo view={view} />}
    />
  );
}

/** Always-available button at the bottom: hold to peek at your role again. */
export function RoleButton({ view }: { view: PlayerView }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const hide = () => setHeld(false);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);
  if (view.phase.kind === "roleReveal") return null;
  return (
    <>
      {held && (
        <div className="overlay role-overlay">
          <RoleInfo view={view} />
        </div>
      )}
      <button
        className="role-button"
        onPointerDown={() => setHeld(true)}
        onPointerUp={() => setHeld(false)}
        onPointerLeave={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {held ? "Loslassen zum Verbergen" : "Rolle ansehen (gedrückt halten)"}
      </button>
    </>
  );
}
