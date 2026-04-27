import type { Block } from "@/content/types";

// ─── Theme tokens (kept consistent with the dark landing) ────────────────────
const T = {
  text: "#E5E7EB",
  textDim: "#9CA3AF",
  textBright: "#F9FAFB",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  surface: "rgba(255,255,255,0.03)",
  surface2: "rgba(255,255,255,0.06)",
  accent: "#6366f1",
  accentDim: "#a5b4fc",
  cyan: "#22d3ee",
  green: "#10b981",
  warn: "#f59e0b",
  errorBg: "rgba(239,68,68,0.08)",
  warnBg: "rgba(245,158,11,0.08)",
  tipBg: "rgba(99,102,241,0.08)",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^а-яa-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <RenderBlock key={i} block={b} />
      ))}
    </>
  );
}

function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return (
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 17,
            lineHeight: 1.7,
            color: T.text,
          }}
        >
          {block.text}
        </p>
      );

    case "h2": {
      const id = block.id ?? slugify(block.text);
      return (
        <h2
          id={id}
          style={{
            margin: "40px 0 16px",
            fontSize: 28,
            lineHeight: 1.25,
            fontWeight: 800,
            color: T.textBright,
            letterSpacing: -0.4,
            scrollMarginTop: 80,
          }}
        >
          {block.text}
        </h2>
      );
    }

    case "h3": {
      const id = block.id ?? slugify(block.text);
      return (
        <h3
          id={id}
          style={{
            margin: "32px 0 12px",
            fontSize: 21,
            lineHeight: 1.3,
            fontWeight: 700,
            color: T.textBright,
            scrollMarginTop: 80,
          }}
        >
          {block.text}
        </h3>
      );
    }

    case "ul":
      return (
        <ul
          style={{
            margin: "0 0 22px",
            paddingLeft: 0,
            listStyle: "none",
          }}
        >
          {block.items.map((item, i) => (
            <li
              key={i}
              style={{
                position: "relative",
                paddingLeft: 28,
                margin: "0 0 10px",
                fontSize: 17,
                lineHeight: 1.65,
                color: T.text,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 6,
                  top: "0.7em",
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: T.accent,
                  display: "block",
                }}
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol
          style={{
            margin: "0 0 22px",
            paddingLeft: 0,
            listStyle: "none",
            counterReset: "ol-counter",
          }}
        >
          {block.items.map((item, i) => (
            <li
              key={i}
              style={{
                position: "relative",
                paddingLeft: 38,
                margin: "0 0 12px",
                fontSize: 17,
                lineHeight: 1.65,
                color: T.text,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: 2,
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: `${T.accent}22`,
                  border: `1px solid ${T.accent}55`,
                  color: T.accentDim,
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );

    case "quote":
      return (
        <blockquote
          style={{
            margin: "24px 0",
            padding: "20px 24px",
            borderLeft: `3px solid ${T.accent}`,
            background: T.surface,
            borderRadius: "0 12px 12px 0",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 19,
              lineHeight: 1.55,
              color: T.textBright,
              fontStyle: "italic",
            }}
          >
            «{block.text}»
          </p>
          {block.author && (
            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                color: T.textDim,
              }}
            >
              — {block.author}
            </div>
          )}
        </blockquote>
      );

    case "code":
      return (
        <pre
          style={{
            margin: "0 0 22px",
            padding: 20,
            borderRadius: 12,
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${T.border}`,
            overflow: "auto",
            fontSize: 14,
            lineHeight: 1.55,
            color: T.text,
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          }}
        >
          <code>{block.code}</code>
        </pre>
      );

    case "callout": {
      const tone = block.tone ?? "info";
      const palette =
        tone === "warn"
          ? { bg: T.warnBg, border: T.warn, accent: T.warn, label: "Важно" }
          : tone === "tip"
            ? { bg: T.tipBg, border: T.accent, accent: T.accentDim, label: "Совет" }
            : { bg: T.surface, border: T.borderStrong, accent: T.cyan, label: "Заметка" };
      return (
        <div
          style={{
            margin: "24px 0",
            padding: "18px 22px",
            borderRadius: 14,
            background: palette.bg,
            border: `1px solid ${palette.border}40`,
          }}
        >
          {(block.title ?? palette.label) && (
            <div
              style={{
                marginBottom: 8,
                fontSize: 12,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                fontWeight: 700,
                color: palette.accent,
              }}
            >
              {block.title ?? palette.label}
            </div>
          )}
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.6,
              color: T.text,
            }}
          >
            {block.text}
          </p>
        </div>
      );
    }

    case "table":
      return (
        <div
          style={{
            margin: "0 0 24px",
            overflowX: "auto",
            borderRadius: 12,
            border: `1px solid ${T.border}`,
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 15,
            }}
          >
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      background: T.surface2,
                      color: T.textBright,
                      fontWeight: 700,
                      fontSize: 13,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      borderBottom: `1px solid ${T.borderStrong}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "12px 16px",
                        color: T.text,
                        lineHeight: 1.55,
                        borderTop: ri === 0 ? "none" : `1px solid ${T.border}`,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "divider":
      return (
        <hr
          style={{
            margin: "32px 0",
            border: "none",
            borderTop: `1px solid ${T.border}`,
          }}
        />
      );
  }
}
