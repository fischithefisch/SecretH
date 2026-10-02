import { useEffect, useState, type ReactNode } from "react";

/** Shows `shown` only while pressed, so neighbours can't read along. */
export function HoldToShow({ hidden, shown }: { hidden: ReactNode; shown: ReactNode }) {
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
  return (
    <div
      className="hold"
      onPointerDown={() => setHeld(true)}
      onPointerUp={() => setHeld(false)}
      onPointerLeave={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {held ? shown : hidden}
      <span className="hold-hint">{held ? "Loslassen zum Verbergen" : "Gedrückt halten zum Ansehen"}</span>
    </div>
  );
}
