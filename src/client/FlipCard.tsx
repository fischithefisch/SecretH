import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

/** A card with two faces that turns over in 3D. `flipped` shows the front. */
export function FlipCard(props: {
  flipped: boolean;
  front: ReactNode;
  back?: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}) {
  return (
    <div className={`flip ${props.className ?? ""}`} style={props.style}>
      <motion.div
        className="flip-inner"
        initial={false}
        animate={{ rotateY: props.flipped ? 0 : 180 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: props.delay ?? 0 }}
      >
        <div className="flip-face flip-front">{props.front}</div>
        <div className="flip-face flip-back">{props.back ?? <CardBack />}</div>
      </motion.div>
    </div>
  );
}

export function CardBack({ label }: { label?: string }) {
  return (
    <div className="card-back">
      <span>{label ?? "SH"}</span>
    </div>
  );
}
