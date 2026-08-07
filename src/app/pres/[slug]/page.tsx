"use client";

/**
 * Публичный просмотр расшаренной презентации: /pres/<slug>.
 *
 * До этого страницы-вьюера не существовало вовсе: /api/presentation-share
 * выдавал ссылку `/r/<slug>`, но этот путь занят лид-ген отчётом
 * (src/app/r/[slug]/page.tsx ищет slug в таблице leads), поэтому каждая
 * выданная клиенту ссылка отдавала 404. Комментарий в db.ts обещал третий
 * путь — /share/[slug], но там публичный снапшот дашборда/КП.
 *
 * Авторизация не нужна — ссылку открывает клиент/инвестор. Если владелец
 * поставил пароль, GET отвечает 401 c reason: "password_required", и мы
 * показываем форму ввода.
 */

import { use, useCallback, useEffect, useState } from "react";

interface Slide {
  title: string;
  subtitle?: string;
  type: string;
  content?: string;
  bullets?: string[];
  stats?: Array<{ value: string; label: string }>;
  quote?: string;
  items?: Array<{ title: string; description?: string }>;
  leftContent?: string;
  rightContent?: string;
  imageUrl?: string;
}

interface Style {
  colors?: string[];
  fontHeader?: string;
  fontBody?: string;
}

/** Только hex — стиль приходит из БД, но подставляется прямо в CSS. */
function safeColor(c: string | undefined, fallback: string): string {
  return c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : fallback;
}
/** Имя шрифта без кавычек/скобок — иначе можно выйти из CSS-значения. */
function safeFont(f: string | undefined, fallback: string): string {
  return f && /^[a-zA-Zа-яА-Я0-9 _-]{1,40}$/.test(f) ? f : fallback;
}

export default function SharedPresentationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [state, setState] = useState<{
    status: "loading" | "ok" | "error" | "password";
    error?: string;
    title?: string;
    slides?: Slide[];
    style?: Style | null;
  }>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [idx, setIdx] = useState(0);

  const load = useCallback(async (pass?: string) => {
    try {
      const qs = new URLSearchParams({ slug });
      if (pass) qs.set("password", pass);
      const res = await fetch(`/api/presentation-share?${qs}`);
      const json = await res.json().catch(() => null);

      if (res.status === 401 && json?.reason === "password_required") {
        setState({ status: "password" });
        return;
      }
      if (!res.ok || !json?.ok) {
        setState({ status: "error", error: json?.error ?? `Ошибка ${res.status}` });
        return;
      }
      const slides: Slide[] = Array.isArray(json.data?.slides) ? json.data.slides : [];
      if (slides.length === 0) {
        setState({ status: "error", error: "Презентация пуста" });
        return;
      }
      setState({ status: "ok", title: json.data.title, slides, style: json.data.style ?? null });
    } catch (e) {
      setState({ status: "error", error: e instanceof Error ? e.message : "Сеть недоступна" });
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const total = state.slides?.length ?? 0;
  const go = useCallback((d: number) => {
    setIdx(i => Math.min(total - 1, Math.max(0, i + d)));
  }, [total]);

  useEffect(() => {
    if (state.status !== "ok") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, go]);

  // ── Состояния до показа слайдов ──────────────────────────────
  if (state.status === "loading") {
    return <Centered><div style={{ color: "#94a3b8", fontSize: 14 }}>Загружаем презентацию…</div></Centered>;
  }

  if (state.status === "password") {
    return (
      <Centered>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!password.trim()) return;
            setChecking(true);
            await load(password);
            setChecking(false);
          }}
          style={{
            width: "100%", maxWidth: 360, background: "#18181b",
            border: "1px solid #27272a", borderRadius: 10, padding: 28,
            display: "flex", flexDirection: "column", gap: 12,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fafafa" }}>Презентация защищена</div>
          <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.5 }}>
            Введите пароль, который передал отправитель.
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoFocus
            style={{
              padding: "11px 13px", borderRadius: 7, border: "1px solid #3f3f46",
              background: "#09090b", color: "#fafafa", fontSize: 14, outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={checking || !password.trim()}
            style={{
              padding: "11px 13px", borderRadius: 7, border: "none",
              background: checking || !password.trim() ? "#3f3f46" : "#6366f1",
              color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: checking || !password.trim() ? "not-allowed" : "pointer",
            }}
          >
            {checking ? "Проверяем…" : "Открыть"}
          </button>
        </form>
      </Centered>
    );
  }

  if (state.status === "error") {
    return (
      <Centered>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>
            Презентация недоступна
          </div>
          <div style={{ fontSize: 13.5, color: "#a1a1aa", lineHeight: 1.6 }}>{state.error}</div>
        </div>
      </Centered>
    );
  }

  // ── Показ ────────────────────────────────────────────────────
  const slides = state.slides!;
  const c = state.style?.colors ?? [];
  const primary = safeColor(c[0], "#1a1a2e");
  const secondary = safeColor(c[1], "#6366f1");
  const bg = safeColor(c[3], "#ffffff");
  const text = safeColor(c[4], "#1a1a2e");
  const fontH = safeFont(state.style?.fontHeader, "Georgia");
  const fontB = safeFont(state.style?.fontBody, "Inter");

  const s = slides[idx];
  const isDark = s.type === "cover" || s.type === "cta" || s.type === "quote";

  return (
    <div style={{
      minHeight: "100vh", background: "#09090b",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "24px 16px 76px", fontFamily: `'${fontB}', system-ui, sans-serif`,
    }}>
      <div style={{
        width: "100%", maxWidth: 1000, display: "flex",
        justifyContent: "space-between", alignItems: "center", marginBottom: 14,
      }}>
        <div style={{ fontSize: 13, color: "#a1a1aa", fontWeight: 600 }}>{state.title}</div>
        <div style={{ fontSize: 12, color: "#71717a", fontVariantNumeric: "tabular-nums" }}>
          {idx + 1} / {total}
        </div>
      </div>

      {/* Слайд 16:9 */}
      <div style={{
        width: "100%", maxWidth: 1000, aspectRatio: "16/9", borderRadius: 12,
        overflow: "hidden", position: "relative", border: "1px solid #27272a",
        background: isDark ? primary : bg,
        color: isDark ? "#ffffff" : text,
        display: "flex", flexDirection: "column",
        padding: "clamp(20px, 4%, 46px)",
      }}>
        {s.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: isDark ? `${primary}e6` : `${bg}d9` }} />
          </>
        )}

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
          {s.subtitle && (
            <div style={{
              fontSize: "clamp(9px, 1.1vw, 12px)", fontWeight: 700, letterSpacing: 2,
              textTransform: "uppercase", color: secondary, marginBottom: 10,
            }}>{s.subtitle}</div>
          )}

          <h1 style={{
            fontFamily: `'${fontH}', Georgia, serif`,
            fontSize: s.type === "cover" ? "clamp(24px, 4.4vw, 50px)" : "clamp(17px, 2.6vw, 30px)",
            fontWeight: 800, lineHeight: 1.12, margin: "0 0 14px", textWrap: "balance",
          }}>{s.title}</h1>

          {s.content && (
            <p style={{ fontSize: "clamp(10px, 1.25vw, 15px)", lineHeight: 1.65, opacity: 0.78, margin: "0 0 14px", maxWidth: "62ch" }}>
              {s.content}
            </p>
          )}

          {s.quote && (
            <blockquote style={{
              fontFamily: `'${fontH}', Georgia, serif`, fontSize: "clamp(14px, 2vw, 26px)",
              lineHeight: 1.45, fontStyle: "italic", margin: "0 0 14px", maxWidth: "48ch",
            }}>«{s.quote}»</blockquote>
          )}

          {(s.stats?.length ?? 0) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(s.stats!.length, 4)}, 1fr)`, gap: "clamp(8px, 1.4%, 18px)", marginTop: "auto" }}>
              {s.stats!.slice(0, 4).map((st, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: `'${fontH}', Georgia, serif`, fontWeight: 800,
                    fontSize: "clamp(18px, 3.4vw, 40px)", color: secondary,
                    fontVariantNumeric: "tabular-nums", lineHeight: 1,
                  }}>{st.value}</div>
                  <div style={{ fontSize: "clamp(7px, 0.85vw, 11px)", opacity: 0.65, marginTop: 6 }}>{st.label}</div>
                </div>
              ))}
            </div>
          )}

          {(s.items?.length ?? 0) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${s.items!.length <= 4 ? 2 : 3}, 1fr)`, gap: "clamp(6px, 1.2%, 14px)", flex: 1, alignContent: "start" }}>
              {s.items!.slice(0, 6).map((it, i) => (
                <div key={i} style={{
                  borderLeft: `3px solid ${secondary}`, paddingLeft: 12,
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  borderRadius: 4, padding: "10px 12px",
                }}>
                  <div style={{ fontSize: "clamp(8px, 1vw, 13px)", fontWeight: 700, marginBottom: 4 }}>{it.title}</div>
                  {it.description && (
                    <div style={{ fontSize: "clamp(7px, 0.8vw, 10.5px)", opacity: 0.66, lineHeight: 1.4 }}>{it.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(s.leftContent || s.rightContent) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(10px, 2%, 26px)", fontSize: "clamp(8px, 1vw, 13px)", lineHeight: 1.6, opacity: 0.82 }}>
              <div>{s.leftContent}</div>
              <div>{s.rightContent}</div>
            </div>
          )}

          {(s.bullets?.length ?? 0) > 0 && (
            <ul style={{ margin: "0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "clamp(4px, 0.9%, 10px)" }}>
              {s.bullets!.map((b, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: "clamp(8px, 1vw, 13.5px)", lineHeight: 1.5 }}>
                  <span style={{ color: secondary, flex: "none", fontWeight: 700 }}>·</span>
                  <span style={{ opacity: 0.88 }}>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Навигация */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px",
        background: "linear-gradient(to top, #09090b, transparent)",
        display: "flex", justifyContent: "center", gap: 10,
      }}>
        <NavBtn onClick={() => go(-1)} disabled={idx === 0} label="‹" />
        <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#71717a", padding: "0 8px", fontVariantNumeric: "tabular-nums" }}>
          {idx + 1} / {total}
        </div>
        <NavBtn onClick={() => go(1)} disabled={idx >= total - 1} label="›" />
      </div>
    </div>
  );
}

function NavBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label === "‹" ? "Предыдущий слайд" : "Следующий слайд"}
      style={{
        width: 42, height: 42, borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
        background: "#18181b", border: "1px solid #27272a",
        color: disabled ? "#3f3f46" : "#e4e4e7", fontSize: 20, lineHeight: 1,
      }}
    >{label}</button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#09090b", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>{children}</div>
  );
}
