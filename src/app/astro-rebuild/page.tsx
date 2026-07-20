"use client";

/**
 * /astro-rebuild — публичная страница пересборки сайта в Astro-проект.
 * Ввод URL → /api/rebuild-astro (скрейп + Claude) → живое превью, отчёт по
 * оптимизации, дерево файлов Astro-проекта и скачивание .zip (jszip, клиент).
 *
 * Без логина — роут защищён IP-лимитом (15/день), а не авторизацией.
 * Результат каждой пересборки сохраняется под id и подставляется в URL
 * (?id=...), поэтому: (а) перезагрузка страницы не сбрасывает результат —
 * он подтягивается заново по этому id; (б) ссылка с ?id= — публичный шеринг
 * ГОТОВОГО результата + формы, по которой можно пересобрать другой сайт.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Copy, Download, ExternalLink,
  Eye, FileCode, FileText, Folder, Gauge, Globe, Info, Loader2, Wrench, Zap,
} from "lucide-react";
import type { AstroFile, OptIssue, RebuildAstroResult, SpeedMetrics } from "@/app/api/rebuild-astro/route";

// ─── Дерево файлов ────────────────────────────────────────────────────────────

type FileNode = {
  name: string;
  path: string;
  children: Record<string, FileNode>;
  file?: AstroFile;
};

function buildTree(files: AstroFile[]): FileNode {
  const root: FileNode = { name: "", path: "", children: {} };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      if (!node.children[part]) {
        node.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: {},
        };
      }
      node = node.children[part];
      if (isLeaf) node.file = f;
    });
  }
  return root;
}

function TreeView({ node, depth, selected, onSelect }: {
  node: FileNode; depth: number; selected: string; onSelect: (f: AstroFile) => void;
}) {
  const entries = Object.values(node.children).sort((a, b) => {
    const aDir = Object.keys(a.children).length > 0 && !a.file;
    const bDir = Object.keys(b.children).length > 0 && !b.file;
    if (aDir !== bDir) return aDir ? -1 : 1; // папки выше
    return a.name.localeCompare(b.name);
  });
  return (
    <>
      {entries.map((child) => {
        const isDir = !child.file;
        const isSel = child.file?.path === selected;
        return (
          <div key={child.path}>
            <div
              onClick={() => child.file && onSelect(child.file)}
              style={{
                padding: "5px 8px", paddingLeft: 8 + depth * 16, cursor: child.file ? "pointer" : "default",
                fontSize: 13, borderRadius: 6, display: "flex", alignItems: "center", gap: 7,
                background: isSel ? "color-mix(in srgb, var(--primary, #2a78d6) 12%, transparent)" : "transparent",
                color: isSel ? "var(--primary, #2a78d6)" : "inherit", fontWeight: isSel ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {isDir
                ? <Folder size={14} style={{ opacity: 0.55, flexShrink: 0 }} />
                : <FileText size={14} style={{ opacity: 0.55, flexShrink: 0 }} />}
              {child.name}
            </div>
            {isDir && <TreeView node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />}
          </div>
        );
      })}
    </>
  );
}

// ─── Мелкие UI-примитивы (инлайн-стили, в духе остального проекта) ────────────

const card: React.CSSProperties = {
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 14,
  background: "var(--card, #fff)",
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ ...card, padding: "14px 16px", minWidth: 130, flex: 1 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground, #6b7280)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: "var(--muted-foreground, #6b7280)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ─── Формат метрик Lighthouse ─────────────────────────────────────────────────

const fmtMs = (v: number | null) => v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} с` : `${Math.round(v)} мс`;
const fmtCls = (v: number | null) => v == null ? "—" : v.toFixed(2);
const fmtMb = (v: number | null) => v == null ? "—" : `${(v / 1024 / 1024).toFixed(1)} МБ`;
const perfColor = (s: number | null) => s == null ? "#6b7280" : s >= 90 ? "#059669" : s >= 50 ? "#d97706" : "#dc2626";

function SpeedColumn({ label, m }: { label: string; m: SpeedMetrics }) {
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground, #6b7280)", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 62, height: 62, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          border: `4px solid ${perfColor(m.performance)}`, fontSize: 20, fontWeight: 850, color: perfColor(m.performance),
        }}>
          {m.performance ?? "—"}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted-foreground, #6b7280)", lineHeight: 1.4 }}>
          Performance<br />(Lighthouse, mobile)
        </div>
      </div>
      {m.error ? (
        <div style={{ fontSize: 12.5, color: "#dc2626", lineHeight: 1.45 }}>{m.error}</div>
      ) : (
        <div style={{ display: "grid", gap: 5 }}>
          {[
            ["LCP (крупный контент)", fmtMs(m.lcpMs)],
            ["FCP (первая отрисовка)", fmtMs(m.fcpMs)],
            ["TBT (блокировка)", fmtMs(m.tbtMs)],
            ["CLS (сдвиги вёрстки)", fmtCls(m.cls)],
            ["Вес страницы", fmtMb(m.bytes)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
              <span style={{ color: "var(--muted-foreground, #6b7280)" }}>{k}</span>
              <span style={{ fontWeight: 650, fontFamily: "ui-monospace, monospace" }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity, fixed }: { severity: OptIssue["severity"]; fixed: boolean }) {
  if (fixed) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "color-mix(in srgb, #059669 12%, transparent)", color: "#059669", whiteSpace: "nowrap" }}>
        <CheckCircle2 size={12} /> Исправлено
      </span>
    );
  }
  const map = {
    critical: { color: "#dc2626", label: "Критично" },
    warn: { color: "#d97706", label: "Внимание" },
    info: { color: "#6b7280", label: "Рекомендация" },
  } as const;
  const m = map[severity];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `color-mix(in srgb, ${m.color} 12%, transparent)`, color: m.color, whiteSpace: "nowrap" }}>
      {severity === "critical" ? <AlertTriangle size={12} /> : <Info size={12} />} {m.label}
    </span>
  );
}

// ─── Страница ─────────────────────────────────────────────────────────────────

type Tab = "preview" | "optimization" | "code";

export default function AstroRebuildPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RebuildAstroResult | null>(null);
  const [active, setActive] = useState<AstroFile | null>(null);
  const [view, setView] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const tree = useMemo(() => (result ? buildTree(result.files) : null), [result]);
  const opt = result?.optimization;
  const fixedCount = opt ? opt.issues.filter(i => i.fixed).length : 0;

  const applyResult = (r: RebuildAstroResult) => {
    setResult(r);
    setActive(r.files.find(f => /index\.astro$/.test(f.path)) ?? r.files[0] ?? null);
    setView("preview");
  };

  // При заходе по ссылке с ?id= — подтягиваем сохранённый результат заново.
  // Это же решает «перезагрузка страницы всё сбрасывает».
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setHydrating(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/rebuild-astro/${id}`);
        const json = await res.json();
        if (json.ok) {
          applyResult(json as RebuildAstroResult);
          setUrl((json as RebuildAstroResult).source.url);
        }
      } catch { /* ссылка устарела — просто покажем пустую форму */ }
      finally { setHydrating(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const toolShareUrl = origin + "/astro-rebuild" + (result ? `?id=${result.id}` : "");

  const copyToolLink = () => {
    if (!toolShareUrl) return;
    navigator.clipboard.writeText(toolShareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* clipboard denied — ссылка видна в поле */ });
  };

  const run = async () => {
    const u = url.trim();
    if (!u) { setError("Введите URL сайта"); return; }
    setLoading(true); setError(null); setResult(null); setActive(null); setView("preview");
    try {
      const res = await fetch("/api/rebuild-astro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ url: u }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Ошибка пересборки");
      const r = json as RebuildAstroResult;
      applyResult(r);
      // Кладём id в URL — переживает перезагрузку и делает ссылку шерабельной.
      window.history.replaceState(null, "", `/astro-rebuild?id=${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  // Этап 2 (отдельная услуга): оптимизация скорости. Ленивые фоны, перенос
  // ассетов к себе, WebP и т.д. — до ~2 минут (качаются все картинки).
  const runOptimize = async () => {
    if (!result || optimizing) return;
    setOptimizing(true); setOptimizeError(null);
    try {
      const res = await fetch("/api/rebuild-astro/optimize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.id }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) throw new Error(json?.error || "Оптимизация не удалась — попробуйте ещё раз");
      setResult(json as RebuildAstroResult);
      setCompareError(null); // старый замер сброшен сервером — можно мерить заново
    } catch (e) {
      setOptimizeError(e instanceof Error ? e.message : "Ошибка оптимизации");
    } finally {
      setOptimizing(false);
    }
  };

  // Замер «было → стало» через Google PageSpeed. До ~2 минут: Lighthouse
  // гоняется по оригиналу и по нашему превью параллельно.
  const runCompare = async () => {
    if (!result || comparing) return;
    setComparing(true); setCompareError(null);
    try {
      const res = await fetch("/api/rebuild-astro/compare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.id }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) throw new Error(json?.error || "Замер не уложился в таймаут — попробуйте ещё раз");
      setResult({ ...result, speedCompare: json.speedCompare });
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : "Ошибка замера");
    } finally {
      setComparing(false);
    }
  };

  // Zip собирается на сервере (/api/rebuild-astro/<id>/zip): в проект входят
  // бинарные ассеты (картинки/шрифты) с диска — клиентский jszip их не видел.

  const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "preview", label: "Живой сайт", icon: <Eye size={14} /> },
    { key: "optimization", label: "Оптимизация", icon: <Gauge size={14} /> },
    { key: "code", label: "Исходники", icon: <FileCode size={14} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--background, #f7f7f8)", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@keyframes ar-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "36px 20px 64px" }}>

        {/* ─── Шапка ─── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--primary, #2a78d6)", marginBottom: 8 }}>
            MarketRadar · Инструменты
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 850, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Перенос сайта на Astro
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--muted-foreground, #6b7280)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
            Вставьте адрес сайта — соберём его заново как чистый Astro-проект с сохранением дизайна 1:1,
            исправим SEO-дыры и оптимизируем загрузку. На выходе — живое превью и готовый проект
            для <code style={{ fontSize: 13 }}>npm install &amp;&amp; npm run build</code>.
          </p>
        </div>

        {/* ─── Форма ─── */}
        <div style={{ ...card, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
              <Globe size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground, #9ca3af)" }} />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !loading) run(); }}
                placeholder="https://example.com"
                disabled={loading}
                style={{
                  width: "100%", height: 46, padding: "0 14px 0 40px", fontSize: 15,
                  border: "1px solid var(--border, #d1d5db)", borderRadius: 10,
                  background: "var(--background, #fff)", color: "inherit",
                }}
              />
            </div>
            <button
              onClick={run}
              disabled={loading}
              style={{
                height: 46, padding: "0 24px", fontSize: 15, fontWeight: 700, borderRadius: 10, border: "none",
                background: loading ? "var(--muted, #9ca3af)" : "var(--primary, #2a78d6)", color: "#fff",
                cursor: loading ? "default" : "pointer", whiteSpace: "nowrap",
                display: "inline-flex", alignItems: "center", gap: 8,
              }}
            >
              {loading
                ? <><Loader2 size={16} style={{ animation: "ar-spin 0.9s linear infinite" }} /> Пересобираем…</>
                : <><Zap size={16} /> Пересобрать</>}
            </button>
          </div>
        </div>

        {hydrating && (
          <div style={{ ...card, padding: 20, fontSize: 14, color: "var(--muted-foreground, #6b7280)", display: "flex", alignItems: "center", gap: 10 }}>
            <Loader2 size={16} style={{ animation: "ar-spin 0.9s linear infinite" }} /> Загружаем сохранённый результат…
          </div>
        )}

        {loading && (
          <div style={{ ...card, padding: 20, fontSize: 14, color: "var(--muted-foreground, #6b7280)", lineHeight: 1.6 }}>
            Скрейпим сайт, анализируем структуру и собираем Astro-проект — до минуты.
            Дизайн сохраняется 1:1, правится только технический внутряк.
          </div>
        )}

        {error && (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "color-mix(in srgb, #dc2626 9%, transparent)", color: "#dc2626", fontSize: 14, marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        {result && (
          <>
            {/* ─── Сводка ─── */}
            <div style={{ ...card, padding: "20px 22px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "color-mix(in srgb, #059669 12%, transparent)", color: "#059669" }}>
                      <CheckCircle2 size={13} /> Готово
                    </span>
                    <span style={{ fontSize: 13, color: "var(--muted-foreground, #6b7280)" }}>
                      {result.source.url} · модель {result.modelUsed}
                    </span>
                  </div>
                  <div style={{ fontSize: 15.5, lineHeight: 1.5, fontWeight: 500 }}>{result.summary || result.source.title}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {result.previewUrl && (
                    <a
                      href={result.previewUrl} target="_blank" rel="noopener noreferrer"
                      style={{
                        height: 42, padding: "0 18px", fontSize: 14, fontWeight: 700, borderRadius: 10,
                        background: "var(--primary, #2a78d6)", color: "#fff", whiteSpace: "nowrap",
                        display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={15} /> Открыть сайт
                    </a>
                  )}
                  <a
                    href={`/api/rebuild-astro/${result.id}/zip`}
                    style={{
                      height: 42, padding: "0 18px", fontSize: 14, fontWeight: 700, borderRadius: 10,
                      background: "var(--success, #059669)", color: "#fff",
                      whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
                    }}
                  >
                    <Download size={15} /> Скачать .zip
                  </a>
                </div>
              </div>

              {/* Метрики */}
              <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
                <StatTile label="SEO-правок" value={String(result.fixes.length)} hint="применено при переносе" />
                <StatTile
                  label="Оптимизаций"
                  value={result.optimizedAt ? String(opt?.applied.length ?? 0) : "—"}
                  hint={result.optimizedAt ? "скорость загрузки" : "не применена — таб «Оптимизация»"}
                />
                <StatTile label="Проблем найдено" value={String((result.source.issues.length) + (opt?.issues.length ?? 0))} hint={`${result.source.issues.length} SEO · ${opt?.issues.length ?? 0} перфоманс`} />
                <StatTile label="Файлов в проекте" value={String(result.files.length)} hint="Astro, готов к сборке" />
              </div>

              {/* Ссылка для шеринга */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground, #6b7280)", marginBottom: 8 }}>
                  Поделиться результатом
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    readOnly
                    value={toolShareUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    style={{
                      minWidth: 0, flex: 1, height: 38, padding: "0 12px", fontSize: 13, borderRadius: 8,
                      border: "1px solid var(--border, #e5e7eb)", background: "var(--muted, #f8fafc)",
                      color: "var(--foreground, #0f1123)", fontFamily: "ui-monospace, monospace",
                    }}
                  />
                  <button
                    onClick={copyToolLink}
                    style={{
                      height: 38, padding: "0 16px", fontSize: 13.5, fontWeight: 700, borderRadius: 8, border: "none",
                      background: copied ? "var(--success, #059669)" : "var(--primary, #2a78d6)",
                      color: "#fff", cursor: "pointer", whiteSpace: "nowrap",
                      display: "inline-flex", alignItems: "center", gap: 7,
                    }}
                  >
                    {copied ? <><Check size={14} /> Скопировано</> : <><Copy size={14} /> Копировать</>}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground, #6b7280)", marginTop: 6 }}>
                  Публичная — вход не нужен. Открывшему сразу покажет этот результат и даст пересобрать другой сайт.
                </div>
              </div>
            </div>

            {/* ─── Табы ─── */}
            <div style={{ display: "inline-flex", gap: 4, marginBottom: 14, padding: 4, borderRadius: 12, background: "var(--muted, #eef0f3)" }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  style={{
                    height: 36, padding: "0 16px", fontSize: 13.5, fontWeight: 650, borderRadius: 9,
                    border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
                    background: view === t.key ? "var(--card, #fff)" : "transparent",
                    color: view === t.key ? "var(--primary, #2a78d6)" : "var(--muted-foreground, #6b7280)",
                    boxShadow: view === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {t.icon} {t.label}
                  {t.key === "optimization" && opt && opt.issues.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 999, background: "color-mix(in srgb, var(--primary, #2a78d6) 14%, transparent)", color: "var(--primary, #2a78d6)", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                      {opt.issues.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ─── Таб: живой сайт ─── */}
            {view === "preview" && (
              <div style={{ ...card, overflow: "hidden", background: "#fff" }}>
                {result.previewUrl ? (
                  <iframe
                    src={result.previewUrl}
                    title="Превью пересобранного сайта"
                    style={{ width: "100%", height: 660, border: "none", display: "block" }}
                  />
                ) : (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--muted-foreground, #6b7280)" }}>
                    Живое превью недоступно. Скачайте .zip и запустите локально.
                  </div>
                )}
              </div>
            )}

            {/* ─── Таб: оптимизация ─── */}
            {view === "optimization" && opt && (
              <div style={{ display: "grid", gap: 14 }}>
                {/* Этап 2 — отдельная услуга: применить оптимизацию */}
                {!result.optimizedAt && (
                  <div style={{ ...card, padding: "20px 22px", border: "2px solid var(--primary, #2a78d6)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 240, flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>
                          Оптимизация скорости — отдельный шаг
                        </div>
                        <div style={{ fontSize: 13.5, color: "var(--muted-foreground, #6b7280)", lineHeight: 1.55 }}>
                          Перенос готов 1:1. Оптимизация исправит найденные ниже проблемы: ленивая
                          загрузка картинок и фонов, перенос ассетов к себе, сжатие в WebP, уборка
                          двойной загрузки конструктора. Дизайн не меняется. Занимает 1–2 минуты.
                        </div>
                      </div>
                      <button
                        onClick={runOptimize}
                        disabled={optimizing}
                        style={{
                          height: 44, padding: "0 22px", fontSize: 14.5, fontWeight: 700, borderRadius: 10, border: "none",
                          background: optimizing ? "var(--muted, #9ca3af)" : "var(--primary, #2a78d6)", color: "#fff",
                          cursor: optimizing ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                        }}
                      >
                        {optimizing
                          ? <><Loader2 size={15} style={{ animation: "ar-spin 0.9s linear infinite" }} /> Оптимизируем…</>
                          : <><Zap size={15} /> Применить оптимизацию</>}
                      </button>
                    </div>
                    {optimizing && (
                      <div style={{ fontSize: 12.5, color: "var(--muted-foreground, #6b7280)", marginTop: 10 }}>
                        Скачиваем и сжимаем картинки, переносим стили и шрифты — не закрывайте страницу.
                      </div>
                    )}
                    {optimizeError && !optimizing && (
                      <div style={{ fontSize: 13, color: "#dc2626", marginTop: 10 }}>{optimizeError}</div>
                    )}
                  </div>
                )}

                {/* Замер скорости: было → стало (Google PageSpeed / Lighthouse) */}
                <div style={{ ...card, padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: result.speedCompare ? 14 : 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Zap size={16} style={{ color: "var(--primary, #2a78d6)" }} />
                      <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Скорость: было → стало
                      </div>
                    </div>
                    <button
                      onClick={runCompare}
                      disabled={comparing}
                      style={{
                        height: 36, padding: "0 16px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none",
                        background: comparing ? "var(--muted, #9ca3af)" : "var(--primary, #2a78d6)", color: "#fff",
                        cursor: comparing ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 7,
                      }}
                    >
                      {comparing
                        ? <><Loader2 size={14} style={{ animation: "ar-spin 0.9s linear infinite" }} /> Замеряем…</>
                        : <><Gauge size={14} /> {result.speedCompare ? "Замерить заново" : "Замерить"}</>}
                    </button>
                  </div>

                  {comparing && (
                    <div style={{ fontSize: 13, color: "var(--muted-foreground, #6b7280)", lineHeight: 1.5 }}>
                      Google PageSpeed прогоняет Lighthouse по оригинальному сайту и по пересобранной
                      версии — обычно 30–90 секунд. Не закрывайте страницу.
                    </div>
                  )}
                  {compareError && !comparing && (
                    <div style={{ fontSize: 13, color: "#dc2626", lineHeight: 1.5 }}>{compareError}</div>
                  )}

                  {result.speedCompare && !comparing && (
                    <>
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "stretch" }}>
                        <SpeedColumn label="Оригинал" m={result.speedCompare.original} />
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <ArrowRight size={20} style={{ color: "var(--muted-foreground, #9ca3af)" }} />
                        </div>
                        <SpeedColumn label="После переноса" m={result.speedCompare.rebuilt} />
                      </div>
                      {result.speedCompare.original.performance != null && result.speedCompare.rebuilt.performance != null && (
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border, #e5e7eb)", fontSize: 13.5, lineHeight: 1.5 }}>
                          {(() => {
                            const d = result.speedCompare.rebuilt.performance - result.speedCompare.original.performance;
                            const tail = result.optimizedAt
                              ? "Остальной потолок — скрипты конструктора (см. рекомендации ниже): их сокращение возможно только ручной доработкой."
                              : "Оптимизация ещё не применена — примените её на этом табе и замерьте заново.";
                            if (d > 0) return <><b style={{ color: "#059669" }}>+{d} баллов Performance.</b> {tail}</>;
                            if (d === 0) return <>Балл пока тот же. {tail}</>;
                            return <>Пересобранная версия пока набирает меньше. {tail} Финальный результат оценивайте после деплоя проекта на хостинг с CDN.</>;
                          })()}
                          <div style={{ fontSize: 11.5, color: "var(--muted-foreground, #6b7280)", marginTop: 4 }}>
                            Замер {new Date(result.speedCompare.measuredAt).toLocaleString("ru-RU")} · Lighthouse mobile · Google PageSpeed API
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!result.speedCompare && !comparing && !compareError && (
                    <div style={{ fontSize: 13, color: "var(--muted-foreground, #6b7280)", lineHeight: 1.5 }}>
                      Реальный замер обеих версий через Google PageSpeed (Lighthouse, mobile):
                      Performance-балл, LCP, TBT, CLS и вес страницы — бок о бок. Занимает 1–2 минуты.
                    </div>
                  )}
                </div>

                {/* Метрики страницы */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <StatTile label="Вес HTML" value={opt.stats.htmlKb > 0 ? `${opt.stats.htmlKb} КБ` : "—"} hint={opt.stats.htmlKb > 200 ? "выше нормы 200 КБ" : "в пределах нормы"} />
                  <StatTile label="Внешних скриптов" value={String(opt.stats.externalScripts)} />
                  <StatTile label="CSS-файлов" value={String(opt.stats.externalCss)} />
                  <StatTile label="Изображений" value={String(opt.stats.images)} hint={opt.stats.lazyImages > 0 ? `${opt.stats.lazyImages} переведено на lazy` : undefined} />
                </div>

                {/* Применено автоматически */}
                {opt.applied.length > 0 && (
                  <div style={{ ...card, padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Wrench size={16} style={{ color: "var(--success, #059669)" }} />
                      <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Применено автоматически ({opt.applied.length})
                      </div>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
                      {opt.applied.map((a, i) => (
                        <li key={i} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.5 }}>
                          <CheckCircle2 size={15} style={{ color: "var(--success, #059669)", flexShrink: 0, marginTop: 2 }} /> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Найденные проблемы */}
                {opt.issues.length > 0 ? (
                  <div style={{ ...card, padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Gauge size={16} style={{ color: "var(--primary, #2a78d6)" }} />
                      <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {result.optimizedAt
                          ? `Проблемы производительности (${opt.issues.length}, исправлено ${fixedCount})`
                          : `Найдено при анализе (${opt.issues.length}) — исправит оптимизация`}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {opt.issues.map((issue, i) => (
                        <div key={i} style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: "13px 15px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 5 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{issue.title}</div>
                            <SeverityBadge severity={issue.severity} fixed={issue.fixed} />
                          </div>
                          <div style={{ fontSize: 13, color: "var(--muted-foreground, #6b7280)", lineHeight: 1.5 }}>{issue.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ ...card, padding: "28px 20px", textAlign: "center", color: "var(--muted-foreground, #6b7280)", fontSize: 14 }}>
                    Проблем производительности не найдено — либо результат создан до появления
                    этого отчёта. Пересоберите сайт заново, чтобы получить свежий анализ.
                  </div>
                )}

                {/* SEO-блок: что нашли и что исправили при переносе */}
                <div style={{ ...card, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <ArrowRight size={16} style={{ color: "var(--primary, #2a78d6)" }} />
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      SEO: найдено на исходном сайте → исправлено при переносе
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Найдено ({result.source.issues.length})</div>
                      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
                        {result.source.issues.map((it, n) => (
                          <li key={n} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.45 }}>
                            <AlertTriangle size={13} style={{ color: "#dc2626", flexShrink: 0, marginTop: 3 }} /> {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success, #059669)", marginBottom: 8 }}>Исправлено ({result.fixes.length})</div>
                      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
                        {result.fixes.map((it, n) => (
                          <li key={n} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.45 }}>
                            <CheckCircle2 size={13} style={{ color: "var(--success, #059669)", flexShrink: 0, marginTop: 3 }} /> {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Таб: исходники ─── */}
            {view === "code" && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 280px) 1fr", gap: 14, alignItems: "start" }}>
                <div style={{ ...card, padding: 8, maxHeight: 580, overflow: "auto" }}>
                  {tree && <TreeView node={tree} depth={0} selected={active?.path ?? ""} onSelect={setActive} />}
                </div>
                <div style={{ ...card, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border, #e5e7eb)", fontSize: 13, fontFamily: "ui-monospace, monospace", color: "var(--muted-foreground, #6b7280)", display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={13} style={{ opacity: 0.6 }} /> {active?.path ?? "выберите файл"}
                  </div>
                  <pre style={{
                    margin: 0, padding: 16, fontSize: 12.5, lineHeight: 1.55, overflow: "auto", maxHeight: 540,
                    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", whiteSpace: "pre",
                  }}>
                    {active?.content ?? ""}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
