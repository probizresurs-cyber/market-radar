/**
 * Общие элементы посадочных: знак бренда и шапка раздела.
 *
 * Жили копиями в /new и /geo. С появлением третьей страницы копий стало бы
 * три — а знак и шапка обязаны выглядеть одинаково на всех.
 */
import React from "react";
export function RadarMark() {
  return (
    <svg className="mrc-logo" width="34" height="34" viewBox="0 0 64 64" fill="none"
      aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="mrc-logo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--mrc-cyan)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--mrc-cyan)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mrc-logo-blade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--mrc-cyan)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--mrc-cyan)" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#mrc-logo-glow)" />
      {[28, 20, 12].map(r => (
        <circle key={r} cx="32" cy="32" r={r} stroke="var(--mrc-logo-ring)" strokeWidth="0.8" fill="none" opacity="0.6" />
      ))}
      <g opacity="0.5" stroke="var(--mrc-cyan)">
        <line x1="32" y1="32" x2="48" y2="18" strokeWidth="0.6" opacity="0.6" />
        <line x1="32" y1="32" x2="20" y2="22" strokeWidth="0.6" opacity="0.6" />
        <line x1="32" y1="32" x2="44" y2="46" strokeWidth="0.6" opacity="0.6" />
        <line x1="32" y1="32" x2="18" y2="42" strokeWidth="0.6" opacity="0.6" />
        <line x1="48" y1="18" x2="44" y2="46" strokeWidth="0.5" opacity="0.35" />
        <line x1="20" y1="22" x2="18" y2="42" strokeWidth="0.5" opacity="0.35" />
      </g>
      <circle cx="48" cy="18" r="2" fill="var(--mrc-green)" />
      <circle cx="20" cy="22" r="2" fill="var(--mrc-cyan)" />
      <circle cx="44" cy="46" r="2" fill="var(--mrc-violet)" />
      <circle cx="18" cy="42" r="2" fill="var(--mrc-cyan)" />
      <circle cx="54" cy="34" r="1" fill="var(--mrc-cyan)" opacity="0.5" />
      <circle cx="10" cy="30" r="1" fill="var(--mrc-cyan)" opacity="0.5" />
      <circle cx="32" cy="8" r="1" fill="var(--mrc-cyan)" opacity="0.5" />
      <g className="mrc-logo-sweep">
        <path d="M 32 32 L 60 32 A 28 28 0 0 0 52 12 Z" fill="url(#mrc-logo-blade)" />
      </g>
      <circle cx="32" cy="32" r="3" fill="var(--mrc-cyan)" />
      <circle cx="32" cy="32" r="5" stroke="var(--mrc-cyan)" strokeWidth="0.5" fill="none" opacity="0.4" />
    </svg>
  );
}

export function SecHead({ idx, title, sub }: { idx: string; title: string; sub: string }) {
  return (
    <header className="mrc-sec-head">
      <span className="mrc-num" aria-hidden="true">{idx}</span>
      <div className="mrc-sec-text">
        <h2 className="mrc-h2">{title}</h2>
        <p className="mrc-lead">{sub}</p>
      </div>
    </header>
  );
}
