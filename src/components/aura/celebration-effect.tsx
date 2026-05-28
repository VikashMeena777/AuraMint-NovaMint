"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ParticleType = "confetti" | "skull";

const CONFETTI_COLORS = ["#FFD700", "#FF6B35", "#34D399", "#818CF8", "#F472B6", "#FBBF24", "#A78BFA"];
const SKULL_EMOJIS = ["💀", "☠️", "🪦", "👻", "😵"];

/**
 * Confetti burst for massive W's (+5000)
 * Skull rain for massive L's (-5000)
 */
export function CelebrationEffect({
  type,
  duration = 3000,
  onComplete,
}: {
  type: ParticleType;
  duration?: number;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const confettiParticles = useMemo(() => {
    if (type !== "confetti") return [];
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.8,
      size: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 720 - 360,
      drift: (Math.random() - 0.5) * 60,
    }));
  }, [type]);

  const skullParticles = useMemo(() => {
    if (type !== "skull") return [];
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.2,
      size: 20 + Math.random() * 16,
      emoji: SKULL_EMOJIS[Math.floor(Math.random() * SKULL_EMOJIS.length)],
      rotation: Math.random() * 40 - 20,
      drift: (Math.random() - 0.5) * 30,
    }));
  }, [type]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          {type === "confetti"
            ? confettiParticles.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{
                    x: `${p.x}vw`,
                    y: -20,
                    rotate: 0,
                    opacity: 1,
                    scale: 1,
                  }}
                  animate={{
                    y: "110vh",
                    x: `${p.x + p.drift}vw`,
                    rotate: p.rotation,
                    opacity: [1, 1, 0.8, 0],
                    scale: [1, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 2.5 + Math.random(),
                    delay: p.delay,
                    ease: "easeIn",
                  }}
                  style={{
                    position: "absolute",
                    width: p.size,
                    height: p.size * 0.6,
                    backgroundColor: p.color,
                    borderRadius: 2,
                  }}
                />
              ))
            : skullParticles.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{
                    x: `${p.x}vw`,
                    y: -40,
                    rotate: 0,
                    opacity: 0.9,
                  }}
                  animate={{
                    y: "110vh",
                    x: `${p.x + p.drift}vw`,
                    rotate: p.rotation,
                    opacity: [0.9, 0.9, 0.6, 0],
                  }}
                  transition={{
                    duration: 3 + Math.random(),
                    delay: p.delay,
                    ease: "easeIn",
                  }}
                  style={{
                    position: "absolute",
                    fontSize: p.size,
                    lineHeight: 1,
                  }}
                >
                  {p.emoji}
                </motion.div>
              ))}
        </div>
      )}
    </AnimatePresence>
  );
}

