"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MINT } from "./mint";

type ParticleType = "confetti" | "skull";

/** Mint palette only — no violet, no rainbow. */
const CONFETTI_COLORS = [MINT.brass, MINT.patinaBright, MINT.brassDeep, MINT.patina, MINT.oxide];
const SKULL_EMOJIS = ["💀", "☠️", "🪦", "😵"];

type ConfettiParticle = {
  id: number;
  x: number;
  delay: number;
  size: number;
  color: string;
  rotation: number;
  drift: number;
  fall: number;
};

type SkullParticle = {
  id: number;
  x: number;
  delay: number;
  size: number;
  emoji: string;
  rotation: number;
  drift: number;
  fall: number;
};

/**
 * Confetti burst for massive W's (±5000+), skull rain for massive L's.
 *
 * Particles are generated **after mount** from a seeded PRNG (never `Math.random()`
 * during render, so no hydration mismatch) and the whole effect collapses to one static
 * stamp frame under `prefers-reduced-motion`.
 */
export function CelebrationEffect({
  type,
  duration = 2600,
  seed = 0,
  onComplete,
}: {
  type: ParticleType;
  duration?: number;
  seed?: number;
  onComplete?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [skulls, setSkulls] = useState<SkullParticle[]>([]);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onCompleteRef.current?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  useEffect(() => {
    let state = (seed * 2654435761) % 2147483647;
    if (state <= 0) state += 2147483646;
    const rand = () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };

    // Generated in a frame callback (not synchronously in the effect) from a seeded PRNG.
    const frame = requestAnimationFrame(() => {
      if (type === "confetti") {
        setConfetti(
          Array.from({ length: 48 }, (_, i) => ({
            id: i,
            x: rand() * 100,
            delay: rand() * 0.5,
            size: 6 + rand() * 7,
            color: CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)],
            rotation: rand() * 540 - 270,
            drift: (rand() - 0.5) * 50,
            fall: 1.8 + rand() * 0.8,
          }))
        );
      } else {
        setSkulls(
          Array.from({ length: 22 }, (_, i) => ({
            id: i,
            x: rand() * 100,
            delay: rand() * 0.7,
            size: 20 + rand() * 14,
            emoji: SKULL_EMOJIS[Math.floor(rand() * SKULL_EMOJIS.length)],
            rotation: rand() * 40 - 20,
            drift: (rand() - 0.5) * 26,
            fall: 2.2 + rand() * 0.8,
          }))
        );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [type, seed]);

  if (!visible) return null;

  if (reducedMotion) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center" aria-hidden="true">
        <div
          className="rounded-2xl border-2 px-6 py-4 text-2xl font-bold"
          style={{
            borderColor: type === "confetti" ? MINT.patina : MINT.oxide,
            color: type === "confetti" ? MINT.patina : MINT.oxide,
          }}
        >
          {type === "confetti" ? "STAMPED" : "STRUCK"}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
      {type === "confetti"
        ? confetti.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}vw`, y: -20, rotate: 0, opacity: 1 }}
              animate={{ y: "110vh", x: `${p.x + p.drift}vw`, rotate: p.rotation, opacity: [1, 1, 0.7, 0] }}
              transition={{ duration: p.fall, delay: p.delay, ease: "easeIn" }}
              style={{
                position: "absolute",
                width: p.size,
                height: p.size * 0.55,
                backgroundColor: p.color,
                borderRadius: 2,
              }}
            />
          ))
        : skulls.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}vw`, y: -40, rotate: 0, opacity: 0.9 }}
              animate={{ y: "110vh", x: `${p.x + p.drift}vw`, rotate: p.rotation, opacity: [0.9, 0.9, 0.5, 0] }}
              transition={{ duration: p.fall, delay: p.delay, ease: "easeIn" }}
              style={{ position: "absolute", fontSize: p.size, lineHeight: 1 }}
            >
              {p.emoji}
            </motion.div>
          ))}
    </div>
  );
}
