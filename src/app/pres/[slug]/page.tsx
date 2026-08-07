"use client";

/**
 * Публичный просмотр расшаренной презентации: /pres/<slug>.
 *
 * Рисует SlideCanvas — ТОТ ЖЕ компонент, что и кабинет (PresentationView).
 * Первая версия этой страницы имела собственный упрощённый рендер, и клиент
 * по ссылке видел плоские слайды без градиентов, декора и логотипа, тогда как
 * автор в кабинете видел нормальную вёрстку. Теперь расхождение невозможно
 * by design: разметка одна на оба места.
 *
 * Авторизация не нужна — ссылку открывает клиент/инвестор. Если владелец
 * поставил пароль, GET отвечает 401 c reason: "password_required", и мы
 * показываем форму ввода.
 */

import { use, useCallback, useEffect, useState } from "react";
import { SlideCanvas, type SlideCanvasSlide } from "@/components/presentation/SlideCanvas";

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
/** Логотип допускаем только как data:image или наш короткий /api/image/... */
function safeLogo(u: string | undefined): string | undefined {
  if (!u) return undefined;
  if (/^data:image\/(png|jpe?g|webp|svg\+xml);base64,/i.test(u)) return u;
  if (/^\/api\/image\/[\w-]+$/.test(u)) return u;
  if (/^https:\/\//i.test(u)) return u;
  return undefined;
}

export default function SharedPresentationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [state, setState] = useState<{
    status: "loading" | "ok" | "error" | "password";
    error?: string;
    title?: string;
    slides?: SlideCanvasSlide[];
    style?: Style | null;
    logoUrl?: string;
    brandName?: string;
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
      const slides: SlideCanvasSlide[] = Array.isArray(json.data?.slides) ? json.data.slides : [];
      if (slides.length === 0) {
        setState({ status: "error", error: "Презентация пуста" });
        return;
      }
      setState({
        status: "ok",
        title: json.data.title,
        slides,
        style: json.data.style ?? null,
        logoUrl: safeLogo(json.data.logoUrl),
        brandName: json.data.brandName,
      });
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
  const fontHeader = safeFont(state.style?.fontHeader, "Georgia");
  const fontBody = safeFont(state.style?.fontBody, "Inter");

  return (
    <div style={{
      minHeight: "100vh", background: "#09090b",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "24px 16px 84px",
      fontFamily: `'${fontBody}', system-ui, sans-serif`,
    }}>
      <div style={{
        width: "100%", maxWidth: 1040, display: "flex",
        justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12,
      }}>
        <div style={{ fontSize: 13, color: "#a1a1aa", fontWeight: 600 }}>{state.title}</div>
        <div style={{ fontSize: 12, color: "#71717a", fontVariantNumeric: "tabular-nums" }}>
          {idx + 1} / {total}
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 1040 }}>
        <SlideCanvas
          slide={slides[idx]}
          idx={idx}
          total={total}
          primary={primary}
          secondary={secondary}
          fontHeader={fontHeader}
          fontBody={fontBody}
          logoUrl={state.logoUrl}
          brandName={state.brandName}
        />
      </div>

      {/* Навигация */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 16px",
        background: "linear-gradient(to top, #09090b 40%, transparent)",
        display: "flex", justifyContent: "center", gap: 10,
      }}>
        <NavBtn onClick={() => go(-1)} disabled={idx === 0} label="‹" />
        <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#71717a", padding: "0 10px", fontVariantNumeric: "tabular-nums" }}>
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
        width: 44, height: 44, borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
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
