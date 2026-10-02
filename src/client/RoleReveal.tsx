import type { PlayerView } from "../game/view";
import { ROLE_LABEL, roleImg } from "./assets";
import { CardBack } from "./FlipCard";
import { HoldToShow } from "./Hold";

/** Your role, your team (if you know it) and what you learned by investigating. */
export function RoleInfo({ view, withCard = true }: { view: PlayerView; withCard?: boolean }) {
  const me = view.you!;
  const role = me.role!;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  const others = Object.entries(view.knownRoles).filter(([id]) => id !== me.id);
  const fascists = others.filter(([, r]) => r === "fascist").map(([id]) => nameOf(id));
  const hitler = others.find(([, r]) => r === "hitler");
  const investigations = Object.entries(view.knownParties);

  return (
    <div className="role-info">
      {withCard && <img className="role-card" src={roleImg(role, me.id)} alt={`Deine Rolle: ${ROLE_LABEL[role]}`} />}
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
  const me = view.you!;
  return (
    <HoldToShow
      hidden={<CardBack label="Geheime Rolle" />}
      shown={<img src={roleImg(me.role!, me.id)} alt={`Deine Rolle: ${ROLE_LABEL[me.role!]}`} />}
      caption={<RoleInfo view={view} withCard={false} />}
    />
  );
}
