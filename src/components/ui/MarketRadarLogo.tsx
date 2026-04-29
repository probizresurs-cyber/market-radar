"use client";

import React from "react";

/**
 * MarketRadar — Network Graph Logo (Variant 1A)
 *
 * Sweeping radar with web-graph nodes connected by dashed lines.
 * 4 colored nodes (green / cyan / violet / cyan) = "30+ data sources"
 * (SEO, social, maps, AI). Animated radar sweep.
 *
 * Usage:
 *   <MarketRadarLogo size={32} />          // dark BG (default)
 *   <MarketRadarLogo size={32} variant="light" />   // light BG
 *   <MarketRadarLogo size={32} variant="mono" />    // monochrome
 *   <MarketRadarLogo size={32} animated={false} />  // no animations
 */

type LogoVariant = "dark" | "light" | "mono";

interface Props {
  size?: number;
  variant?: LogoVariant;
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

let _idCounter = 0;
function useUniqueId(prefix: string): string {
  // Stable per-render unique ID (prevents SVG <defs> collisions)
  const ref = React.useRef<string | null>(null);
  if (ref.current === null) {
    _idCounter += 1;
    ref.current = `${prefix}-${_idCounter}`;
  }
  return ref.current;
}

export function MarketRadarLogo({
  size = 32,
  variant = "dark",
  animated = true,
  className,
  style,
}: Props) {
  const gradId = useUniqueId("mr-glow");
  const bladeId = useUniqueId("mr-blade");

  // Color palette per variant
  const palette = {
    dark: {
      glow: "#00D4FF",
      ring: "#1A3F5C",
      ringOpacity: 0.6,
      connection: "#00D4FF",
      nodeGreen: "#00FF94",
      nodeCyan: "#00D4FF",
      nodeViolet: "#9B59FF",
      sweepStart: "#00D4FF",
      sweepEnd: "#00D4FF",
      core: "#00D4FF",
      coreRing: "#00D4FF",
    },
    light: {
      glow: "#0099CC",
      ring: "#C9D1E3",
      ringOpacity: 1,
      connection: "#0099CC",
      nodeGreen: "#00A65C",
      nodeCyan: "#0099CC",
      nodeViolet: "#7433CC",
      sweepStart: "#0099CC",
      sweepEnd: "#0099CC",
      core: "#0A0E1A",
      coreRing: "#0A0E1A",
    },
    mono: {
      glow: "#ffffff",
      ring: "#ffffff",
      ringOpacity: 0.3,
      connection: "#ffffff",
      nodeGreen: "#ffffff",
      nodeCyan: "#ffffff",
      nodeViolet: "#ffffff",
      sweepStart: "#ffffff",
      sweepEnd: "#ffffff",
      core: "#ffffff",
      coreRing: "#ffffff",
    },
  }[variant];

  const sweepClass = animated ? "mr-logo-sweep" : "";
  const nodeClass = animated ? "mr-logo-node" : "";
  const connClass = animated ? "mr-logo-conn" : "";
  const coreClass = animated ? "mr-logo-core" : "";

  return (
    <>
      {animated && (
        <style>{`
          @keyframes mr-logo-sweep-rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes mr-logo-node-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
          @keyframes mr-logo-conn-flow { 0% { stroke-dashoffset: 20; } 100% { stroke-dashoffset: 0; } }
          @keyframes mr-logo-core-pulse { 0%,100% { opacity: 0.85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
          .mr-logo-sweep { transform-origin: 32px 32px; animation: mr-logo-sweep-rot 4s linear infinite; }
          .mr-logo-node { animation: mr-logo-node-pulse 2.5s ease-in-out infinite; }
          .mr-logo-node-d1 { animation-delay: 0.3s; }
          .mr-logo-node-d2 { animation-delay: 0.7s; }
          .mr-logo-node-d3 { animation-delay: 1.2s; }
          .mr-logo-conn { stroke-dasharray: 4 4; animation: mr-logo-conn-flow 1.5s linear infinite; }
          .mr-logo-core { transform-origin: 32px 32px; animation: mr-logo-core-pulse 1.8s ease-in-out infinite; }
        `}</style>
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        style={{ flexShrink: 0, display: "block", ...style }}
        aria-label="MarketRadar"
        role="img"
      >
        <defs>
          {variant !== "mono" && (
            <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={palette.glow} stopOpacity={variant === "dark" ? 0.25 : 0.12} />
              <stop offset="100%" stopColor={palette.glow} stopOpacity={0} />
            </radialGradient>
          )}
          <linearGradient id={bladeId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.sweepStart} stopOpacity={0} />
            <stop offset="100%" stopColor={palette.sweepEnd} stopOpacity={variant === "mono" ? 0.25 : 0.5} />
          </linearGradient>
        </defs>

        {/* Glow background */}
        {variant !== "mono" && <circle cx="32" cy="32" r="30" fill={`url(#${gradId})`} />}

        {/* Concentric rings */}
        <circle cx="32" cy="32" r="28" stroke={palette.ring} strokeWidth="0.8" fill="none" opacity={palette.ringOpacity} />
        {variant !== "mono" && (
          <>
            <circle cx="32" cy="32" r="20" stroke={palette.ring} strokeWidth="0.8" fill="none" opacity={palette.ringOpacity} />
            <circle cx="32" cy="32" r="12" stroke={palette.ring} strokeWidth="0.8" fill="none" opacity={palette.ringOpacity} />
          </>
        )}
        {variant === "mono" && (
          <circle cx="32" cy="32" r="16" stroke={palette.ring} strokeWidth="1" fill="none" opacity={palette.ringOpacity} />
        )}

        {/* Web-graph connections (dashed, flowing) */}
        <g opacity={variant === "mono" ? 0.5 : 0.5}>
          <line className={connClass} x1="32" y1="32" x2="48" y2="18" stroke={palette.connection} strokeWidth="0.6" opacity={variant === "mono" ? 0.5 : 0.6} />
          <line className={connClass} x1="32" y1="32" x2="20" y2="22" stroke={palette.connection} strokeWidth="0.6" opacity={variant === "mono" ? 0.5 : 0.6} />
          <line className={connClass} x1="32" y1="32" x2="44" y2="46" stroke={palette.connection} strokeWidth="0.6" opacity={variant === "mono" ? 0.5 : 0.6} />
          <line className={connClass} x1="32" y1="32" x2="18" y2="42" stroke={palette.connection} strokeWidth="0.6" opacity={variant === "mono" ? 0.5 : 0.6} />
          {variant === "dark" && (
            <>
              <line className={connClass} x1="48" y1="18" x2="44" y2="46" stroke={palette.connection} strokeWidth="0.5" opacity={0.35} />
              <line className={connClass} x1="20" y1="22" x2="18" y2="42" stroke={palette.connection} strokeWidth="0.5" opacity={0.35} />
            </>
          )}
        </g>

        {/* Network nodes — colored = different data sources */}
        <circle className={nodeClass} cx="48" cy="18" r={variant === "mono" ? 2.5 : 2} fill={palette.nodeGreen} />
        <circle className={`${nodeClass} mr-logo-node-d1`} cx="20" cy="22" r={variant === "mono" ? 2.5 : 2} fill={palette.nodeCyan} />
        <circle className={`${nodeClass} mr-logo-node-d2`} cx="44" cy="46" r={variant === "mono" ? 2.5 : 2} fill={palette.nodeViolet} />
        <circle className={`${nodeClass} mr-logo-node-d3`} cx="18" cy="42" r={variant === "mono" ? 2.5 : 2} fill={palette.nodeCyan} />

        {/* Distant tiny nodes (suggestion of larger network) — only on dark */}
        {variant === "dark" && (
          <>
            <circle cx="54" cy="34" r="1" fill={palette.nodeCyan} opacity={0.5} />
            <circle cx="10" cy="30" r="1" fill={palette.nodeCyan} opacity={0.5} />
            <circle cx="32" cy="8" r="1" fill={palette.nodeCyan} opacity={0.5} />
          </>
        )}

        {/* Radar sweep */}
        <g className={sweepClass}>
          <path
            d={variant === "mono" ? "M 32 32 L 58 32 A 26 26 0 0 0 50 14 Z" : "M 32 32 L 60 32 A 28 28 0 0 0 52 12 Z"}
            fill={`url(#${bladeId})`}
          />
        </g>

        {/* Core hub */}
        <circle className={coreClass} cx="32" cy="32" r={variant === "mono" ? 3.5 : 3} fill={palette.core} />
        {variant === "dark" && (
          <circle cx="32" cy="32" r="5" stroke={palette.coreRing} strokeWidth="0.5" fill="none" opacity={0.4} />
        )}
      </svg>
    </>
  );
}

/**
 * MarketRadar wordmark — иконка + текст.
 * Используется в навигации лендинга и сайдбаре платформы.
 */
export function MarketRadarWordmark({
  iconSize = 32,
  fontSize = 15,
  variant = "dark",
  animated = true,
  textColor,
  gap = 10,
  className,
  style,
}: {
  iconSize?: number;
  fontSize?: number;
  variant?: LogoVariant;
  animated?: boolean;
  textColor?: string;
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        ...style,
      }}
    >
      <MarketRadarLogo size={iconSize} variant={variant} animated={animated} />
      <span
        style={{
          fontWeight: 800,
          fontSize,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          fontFamily: "inherit",
          color: textColor,
        }}
      >
        <span style={{ fontWeight: 400, opacity: 0.55 }}>Market</span>Radar
      </span>
    </div>
  );
}
