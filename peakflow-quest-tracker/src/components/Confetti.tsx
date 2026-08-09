"use client";

import { useState } from "react";

const COLORS = ["#22c55e", "#4ade80", "#86efac", "#f5f5f5", "#16a34a"];

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  round: boolean;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 300,
    duration: 800 + Math.random() * 700,
    color: COLORS[i % COLORS.length],
    round: Math.random() > 0.5,
  }));
}

export function Confetti({ pieceCount = 24 }: { pieceCount?: number }) {
  const [pieces] = useState(() => makePieces(pieceCount));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}ms`,
            animationDuration: `${piece.duration}ms`,
            borderRadius: piece.round ? "50%" : "1px",
          }}
        />
      ))}
    </div>
  );
}
