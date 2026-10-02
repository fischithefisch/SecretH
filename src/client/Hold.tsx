import { useEffect, useState, type ReactNode } from "react";
import { FlipCard } from "./FlipCard";

/** Shows `shown` only while pressed (turning the card over), so neighbours can't read along. */
export function HoldToShow(props: { hidden: ReactNode; shown: ReactNode; caption?: ReactNode }) {
  const held = useHold();
  return (
    <div className="hold" {...held.handlers}>
      <FlipCard flipped={held.active} front={props.shown} back={props.hidden} className="hold-card" />
      {held.active && props.caption}
      <span className="hold-hint">{held.active ? "Loslassen zum Verbergen" : "Gedrückt halten zum Ansehen"}</span>
    </div>
  );
}

/** Press-and-hold state that also resets when the app goes to the background. */
export function useHold() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const hide = () => setActive(false);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);
  return {
    active,
    handlers: {
      onPointerDown: () => setActive(true),
      onPointerUp: () => setActive(false),
      onPointerLeave: () => setActive(false),
      onPointerCancel: () => setActive(false),
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    },
  };
}
