import { createContext, useContext, useState } from "react";
import { POWER_LABEL } from "../game/rules";
import type { PlayerView } from "../game/view";
import { IMG, membershipImg, policyImg } from "./assets";
import { HoldToShow } from "./Hold";
import { RoleCardHold } from "./RoleReveal";
import type { RoomState } from "./useRoom";

const nameOf = (v: PlayerView, id: string | null) => v.players.find((p) => p.id === id)?.name ?? "?";

/** One line telling everyone what is happening and whether it's their turn. */
export function describeStatus(v: PlayerView): { text: string; mine: boolean } {
  const me = v.you!;
  const isPres = me.id === v.presidentId;
  const isChan = me.id === v.chancellorId;
  const P = nameOf(v, v.presidentId);
  const C = nameOf(v, v.chancellorId);
  const phase = v.phase;
  switch (phase.kind) {
    case "roleReveal": {
      const me2 = v.players.find((p) => p.id === me.id)!;
      const seen = v.players.filter((p) => p.seenRole).length;
      return me2.seenRole
        ? { text: `Warte, bis alle ihre Rolle angesehen haben (${seen}/${v.players.length}).`, mine: false }
        : { text: "Sieh dir unbemerkt deine geheime Rolle an.", mine: true };
    }
    case "nominate":
      return isPres
        ? { text: "Du bist Präsident: Nominiere einen Kanzler.", mine: true }
        : { text: `${P} nominiert einen Kanzler.`, mine: false };
    case "vote": {
      const waiting = v.players.filter((p) => p.alive && !p.hasVoted).length;
      const mine = me.alive && v.myVote === null;
      return { text: mine ? `Stimm ab: ${P} & ${C}?` : `Abstimmung läuft – noch ${waiting} offen.`, mine };
    }
    case "presidentDiscard":
      return isPres
        ? { text: "Lege ein Gesetz verdeckt ab.", mine: true }
        : { text: `${P} sieht sich drei Gesetze an. Nicht reden!`, mine: false };
    case "chancellorEnact":
      return isChan
        ? { text: "Erlasse eines der zwei Gesetze.", mine: true }
        : { text: `${C} wählt ein Gesetz. Nicht reden!`, mine: false };
    case "vetoProposed":
      return isPres
        ? { text: `${C} möchte ein Veto einlegen. Stimmst du zu?`, mine: true }
        : { text: `${C} will ein Veto. ${P} entscheidet.`, mine: false };
    case "power":
      return isPres
        ? { text: `Präsidentenmacht: ${POWER_LABEL[phase.power]}.`, mine: true }
        : { text: `${P} nutzt die Präsidentenmacht: ${POWER_LABEL[phase.power]}.`, mine: false };
    case "gameOver":
      return { text: "Spiel vorbei!", mine: false };
    default:
      return { text: "", mine: false };
  }
}

/** Whether ActionPanel has anything to show for this player right now. */
export function hasActionPanel(v: PlayerView): boolean {
  const me = v.you;
  if (!me) return false;
  const isPres = me.id === v.presidentId;
  const isChan = me.id === v.chancellorId;
  switch (v.phase.kind) {
    case "roleReveal":
      return true;
    case "nominate":
    case "presidentDiscard":
    case "power":
      return isPres;
    case "vote":
      return me.alive;
    case "chancellorEnact":
      return isChan;
    case "vetoProposed":
      return isPres || isChan;
    default:
      return false;
  }
}

export function ActionPanel({ view, room }: { view: PlayerView; room: RoomState }) {
  const v = view;
  const me = v.you!;
  const isPres = me.id === v.presidentId;
  const isChan = me.id === v.chancellorId;
  const phase = v.phase;

  switch (phase.kind) {
    case "roleReveal": {
      const seen = v.players.find((p) => p.id === me.id)!.seenRole;
      return (
        <section className="panel action">
          <RoleCardHold view={v} />
          {!seen && (
            <button className="btn primary big" onClick={() => room.act({ type: "ackRole" })}>
              Ich kenne meine Rolle
            </button>
          )}
        </section>
      );
    }

    case "nominate":
      if (!isPres) return null;
      return (
        <section className="panel action">
          <PlayerPicker
            view={v}
            confirmLabel={(name) => `${name} als Kanzler nominieren`}
            onConfirm={(id) => room.act({ type: "nominate", targetId: id })}
          />
          <p className="muted small center">Ausgegraut: zuletzt gewählte Regierung (gesperrt).</p>
        </section>
      );

    case "vote":
      if (!me.alive) return null;
      return (
        <section className="panel action">
          <p className="center small">
            <b>{nameOf(v, v.presidentId)}</b> (Präsident) &amp; <b>{nameOf(v, v.chancellorId)}</b> (Kanzler)
          </p>
          <div className="vote-cards">
            {[true, false].map((ja) => (
              <button
                key={String(ja)}
                className={`vote-card ${v.myVote === ja ? "chosen" : ""} ${v.myVote === !ja ? "faded" : ""}`}
                onClick={() => room.act({ type: "vote", ja })}
                aria-pressed={v.myVote === ja}
              >
                <img src={ja ? IMG.ja : IMG.nein} alt={ja ? "Ja!" : "Nein!"} />
              </button>
            ))}
          </div>
          {v.myVote !== null && <p className="muted center small">Ändern geht, bis alle abgestimmt haben.</p>}
        </section>
      );

    case "presidentDiscard":
      if (!isPres || !v.hand) return null;
      return (
        <section className="panel action">
          <CardPicker
            key={`pd-${v.seq}`}
            cards={v.hand}
            hint="Tippe das Gesetz an, das du ablegen willst."
            confirmLabel="Ablegen & Rest weitergeben"
            onConfirm={(index) => room.act({ type: "presidentDiscard", index })}
          />
        </section>
      );

    case "chancellorEnact":
      if (!isChan || !v.hand) return null;
      return (
        <section className="panel action">
          <CardPicker
            key={`ce-${v.seq}`}
            cards={v.hand}
            hint="Tippe das Gesetz an, das du erlassen willst."
            confirmLabel="Dieses Gesetz erlassen"
            onConfirm={(index) => room.act({ type: "chancellorEnact", index })}
          />
          {v.config && v.fascistPolicies >= v.config.vetoFrom && !phase.vetoDenied && (
            <button className="btn danger" onClick={() => room.act({ type: "proposeVeto" })}>
              Veto vorschlagen
            </button>
          )}
          {phase.vetoDenied && <p className="muted small">Der Präsident hat das Veto abgelehnt.</p>}
        </section>
      );

    case "vetoProposed":
      if (isChan && v.hand) {
        return (
          <section className="panel action">
            <p className="muted center">Warte auf die Entscheidung des Präsidenten …</p>
            <div className="cards">
              {v.hand.map((c, i) => (
                <img key={i} className="policy-card" src={policyImg(c)} alt={c === "L" ? "Liberal" : "Faschistisch"} />
              ))}
            </div>
          </section>
        );
      }
      if (!isPres) return null;
      return (
        <section className="panel action">
          <p className="center">Beide Gesetze ablegen? Der Wahl-Tracker rückt dann eins vor.</p>
          <div className="row center">
            <button className="btn primary" onClick={() => room.act({ type: "vetoResponse", accept: true })}>
              Veto zustimmen
            </button>
            <button className="btn" onClick={() => room.act({ type: "vetoResponse", accept: false })}>
              Ablehnen
            </button>
          </div>
        </section>
      );

    case "power":
      if (!isPres) return null;
      return <PowerPanel view={v} room={room} />;

    default:
      return null;
  }
}

function PowerPanel({ view: v, room }: { view: PlayerView; room: RoomState }) {
  const phase = v.phase;
  if (phase.kind !== "power") return null;

  switch (phase.power) {
    case "peek":
      return (
        <section className="panel action">
          <p className="center">Die obersten drei Gesetze (Reihenfolge bleibt):</p>
          <div className="cards">
            {v.peek?.map((c, i) => (
              <img key={i} className="policy-card" src={policyImg(c)} alt={c === "L" ? "Liberal" : "Faschistisch"} />
            ))}
          </div>
          <button className="btn primary big" onClick={() => room.act({ type: "ackPower" })}>
            Weiter
          </button>
        </section>
      );

    case "investigate":
      if (v.investigation) {
        return (
          <section className="panel action center">
            <p>
              Parteizugehörigkeit von <b>{nameOf(v, v.investigation.targetId)}</b>:
            </p>
            <HoldToShow
              hidden={<img className="member-card" src={IMG.membershipBack} alt="Verdeckte Parteikarte" />}
              shown={
                <img
                  className="member-card"
                  src={membershipImg(v.investigation.party)}
                  alt={v.investigation.party === "liberal" ? "Liberal" : "Faschist"}
                />
              }
            />
            <button className="btn primary big" onClick={() => room.act({ type: "ackPower" })}>
              Weiter
            </button>
          </section>
        );
      }
      return (
        <section className="panel action">
          <PlayerPicker
            view={v}
            confirmLabel={(name) => `${name} untersuchen`}
            onConfirm={(id) => room.act({ type: "investigate", targetId: id })}
          />
        </section>
      );

    case "specialElection":
      return (
        <section className="panel action">
          <PlayerPicker
            view={v}
            confirmLabel={(name) => `${name} wird nächster Präsidentschaftskandidat`}
            onConfirm={(id) => room.act({ type: "specialElection", targetId: id })}
          />
        </section>
      );

    case "execute":
      return (
        <section className="panel action">
          <PlayerPicker
            view={v}
            confirmLabel={(name) => `${name} hinrichten`}
            danger
            onConfirm={(id) => room.act({ type: "execute", targetId: id })}
          />
        </section>
      );
  }
}

function PlayerPicker(props: {
  view: PlayerView;
  confirmLabel: (name: string) => string;
  onConfirm: (id: string) => void;
  danger?: boolean;
}) {
  const { picked } = useContext(PickContext);
  const eligible = pickTargets(props.view) ?? [];
  const players = props.view.players.filter((p) => eligible.includes(p.id));
  const chosen = players.find((p) => p.id === picked);
  return (
    <div className="picker">
      {!chosen && <p className="center muted small">Tippe am Tisch auf einen der hellen Plätze.</p>}
      <button
        className={`btn big ${props.danger ? "danger" : "primary"}`}
        disabled={!chosen}
        onClick={() => chosen && props.onConfirm(chosen.id)}
      >
        {chosen ? props.confirmLabel(chosen.name) : "Spieler auswählen"}
      </button>
    </div>
  );
}

/** Players the viewer may pick right now (nomination or a presidential power), or null. */
export function pickTargets(v: PlayerView): string[] | null {
  const me = v.you;
  if (!me || me.id !== v.presidentId) return null;
  const others = v.players.filter((p) => p.alive && p.id !== me.id);
  const phase = v.phase;
  if (phase.kind === "nominate") return phase.eligibleIds;
  if (phase.kind !== "power") return null;
  if (phase.power === "investigate") return v.investigation ? null : others.filter((p) => !p.investigated).map((p) => p.id);
  if (phase.power === "specialElection" || phase.power === "execute") return others.map((p) => p.id);
  return null;
}

export const PickContext = createContext<{ picked: string | null; setPicked: (id: string | null) => void }>({
  picked: null,
  setPicked: () => {},
});

function CardPicker(props: {
  cards: ("L" | "F")[];
  hint: string;
  confirmLabel: string;
  onConfirm: (index: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="picker">
      <p className="center">{props.hint}</p>
      <div className="cards">
        {props.cards.map((c, i) => (
          <button
            key={i}
            className={`card-btn ${selected === i ? "selected" : ""}`}
            onClick={() => setSelected(i)}
            aria-pressed={selected === i}
          >
            <img className="policy-card" src={policyImg(c)} alt={c === "L" ? "Liberales Gesetz" : "Faschistisches Gesetz"} />
          </button>
        ))}
      </div>
      <button className="btn primary big" disabled={selected === null} onClick={() => props.onConfirm(selected!)}>
        {props.confirmLabel}
      </button>
    </div>
  );
}
