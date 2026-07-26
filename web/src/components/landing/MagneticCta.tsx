"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import styled from "styled-components";
import { motion, useReducedMotion } from "framer-motion";
import { playLandingTone } from "./useLandingAudio";

const mint = "#76d9aa";

const Btn = styled(motion.button)`
  margin-top: 30px;
  padding: 15px 24px;
  border: 0;
  border-radius: 99px;
  background: #f6f1e8;
  color: #171126;
  font: 600 14px var(--font-body);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0 0 rgba(118, 217, 170, 0);
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(118, 217, 170, 0.35), transparent 55%);
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  &:hover {
    background: ${mint};
    box-shadow: 0 18px 44px rgba(118, 217, 170, 0.28);
  }
  &:hover::after {
    opacity: 1;
  }
  span {
    position: relative;
    z-index: 1;
  }
`;

export default function MagneticCta({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ref.current.style.setProperty("--mx", `${x}px`);
    ref.current.style.setProperty("--my", `${y}px`);
    setOffset({
      x: (x - rect.width / 2) * 0.28,
      y: (y - rect.height / 2) * 0.28,
    });
  };

  return (
    <Btn
      ref={ref}
      type="button"
      onMouseMove={onMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      onClick={() => {
        playLandingTone("click");
        onClick();
      }}
      animate={reduce ? undefined : { x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 260, damping: 18, mass: 0.4 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
    >
      <span>{children}</span>
    </Btn>
  );
}
