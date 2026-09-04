"use client";

/**
 * GEO-аудит сайта — UI над /api/geo-agent/audit (src/lib/geo-agent).
 *
 * Показывает то, что раньше жило только в CLI и в agent_runs: скор по пяти
 * опорам, что именно провалено и как чинить, что ответили реальные
 * ассистенты и кого процитировали вместо нас, готовые артефакты
 * (llms.txt, robots-блок, JSON-LD, FAQ-черновики, answer-капсулы).
 *
 * Здесь же — начало петли продукта «SEO + GEO»:
 *   аудит → промпт-банк (по чему меряем каждый месяц) → «написать статью
 *   под незакрытый промпт» → размещения → динамика по прогонам.
 *
 * Принципы те же, что у агента: «н/д» показывается как «н/д», а не как ноль;
 * артефакты — черновики с плейсхолдерами, если не было ключа Claude; каждый
 * ответ ассистента можно раскрыть и прочитать целиком.
 *
 * Хранение: последний полный отчёт — localStorage (быстро, большой); история
 * прогонов (компактные снимки) и промпт-банк — user_data через syncToServer,
 * чтобы «было/стало» и набор промптов не терялись между устройствами.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Radar, Loader2, CheckCircle2, AlertTriangle, XCircle, MinusCircle,
  ChevronDown, ChevronUp, Copy, Check, Download, ExternalLink, FileText, Save, ListChecks,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import type { Colors } from "@/lib/colors";
import { syncToServer, loadAllFromServer } from "@/lib/user";
import {
  GEO_PILLAR_LABELS, PROBE_LLM_LABELS,
  type GeoReport, type GeoPillar, type GeoCheck, type ActionItem, type ProbeAnswer, type GeoPrompt,
} from "@/lib/geo-agent/types";

interface Props {
  c: Colors;
  analysis: AnalysisResult | null;
  userId: string;
  /** Открыть генератор статьи (AppShell переключает nav на seo-new). */
  onWriteArticle?: () => void;
  /** Готовый отчёт — для превью/тестов рендера без похода в API. */
  initialReport?: GeoReport;
}

/** Компактный снимок прогона — для истории «было/стало» в user_data. */
export interface GeoRunSnapshot {
  createdAt: string;
  domain: string;
  score: number;
  pillars: Record<GeoPillar, number>;
  mentionRate?: number;
  citationRate?: number;
  llms?: string[];
  topActions: string[];
  citedInstead: string[];
}

/** Передача темы в генератор статей (читает SEOArticlesView при открытии seo-new). */
export interface GeoArticleHandoff {
  topic: string;
  articleType: "comparison" | "faq" | "informational";
  mode: "geo";
  fromPrompt: string;
}

export const GEO_HANDOFF_KEY = (userId: string) => `mr_geo_article_handoff_${userId || "anon"}`;
const LAST_KEY = (userId: string) => `mr_geo_audit_${userId || "anon"}`;
const HISTORY_KEY = "mr_geo_audit_history";
const PROMPTS_KEY = "mr_geo_prompts";
const HISTORY_MAX = 12;

const PILLARS: GeoPillar[] = ["access", "extract", "entity", "freshness", "external"];

const STATUS_META = {
  pass: { icon: <CheckCircle2 size={14} />, color: "var(--success)", label: "ок" },
  warn: { icon: <AlertTriangle size={14} />, color: "#f59e0b", label: "частично" },
  fail: { icon: <XCircle size={14} />, color: "var(--destructive)", label: "провал" },
  na:   { icon: <MinusCircle size={14} />, color: "var(--muted-foreground)", label: "н/д" },
} as const;

const EFFORT_LABEL: Record<ActionItem["effort"], string> = { hour: "≈ час", day: "≈ день", week: "≈ неделя", ongoing: "постоянно" };
const IMPACT_LABEL: Record<ActionItem["impact"], string> = { high: "сильно", medium: "средне", low: "слабо" };
const INTENT_LABEL: Record<GeoPrompt["intent"], string> = { recommend: "рекомендация", compare: "сравнение", howto: "как выбрать", price: "цена", brand: "о бренде", define: "что такое" };

function scoreColor(v: number): string {
  if (v < 0) return "var(--muted-foreground)";
  if (v >= 75) return "var(--success)";
  if (v >= 45) return "#f59e0b";
  return "var(--destructive)";
}

function toSnapshot(r: GeoReport): GeoRunSnapshot {
  return {
    createdAt: r.createdAt,
    domain: r.crawl.domain,
    score: r.score.total,
    pillars: r.score.pillars,
    mentionRate: r.visibility?.mentionRate,
    citationRate: r.visibility?.citationRate,
    llms: r.visibility?.llmsChecked,
    topActions: r.plan.slice(0, 3).map(p => p.title),
    citedInstead: (r.visibility?.citedDomains ?? []).filter(d => !d.isUs).slice(0, 8).map(d => d.domain),
  };
}

/** Тема статьи из промпта: сравнение — если промпт про выбор/сравнение, иначе FAQ. */
function handoffFromPrompt(p: GeoPrompt, brand: string): GeoArticleHandoff {
  const compare = p.intent === "compare" || p.intent === "recommend";
  const topic = compare
    ? `${brand ? brand + " или альтернативы" : "Сравнение"}: ${p.text.replace(/[?.]+$/, "")}`
    : p.text.replace(/[?.]+$/, "");
  return { topic, articleType: compare ? "comparison" : p.intent === "define" ? "informational" : "faq", mode: "geo", fromPrompt: p.text };
}

function CopyButton({ text, label = "Скопировать" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="ds-btn"
      style={{ fontSize: 12, padding: "4px 10px", display: "inline-flex", gap: 6, alignItems: "center" }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard недоступен — ничего страшного */ }
      }}
    >
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? "Скопировано" : label}
    </button>
  );
}

function Section({ title, subtitle, children, defaultOpen = true, right }: { title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean; right?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ds-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
          {right}
          <span style={{ color: "var(--muted-foreground)", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
        </div>
      </div>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

function CheckRow({ check }: { check: GeoCheck }) {
  const [open, setOpen] = useState(false);
  const m = STATUS_META[check.status];
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={{ color: m.color, marginTop: 2, flexShrink: 0 }}>{m.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{check.label}</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>{check.detail}</div>
        </div>
        <span style={{ fontSize: 11, color: m.color, fontWeight: 600, whiteSpace: "nowrap" }}>{m.label} · {check.weight}</span>
      </div>
      {open && (check.fix || check.snippet || (check.urls && check.urls.length > 0)) && (
        <div style={{ marginLeft: 24, marginTop: 8, fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.55 }}>
          {check.fix && <div style={{ marginBottom: 6 }}><b>Как чинить:</b> {check.fix}</div>}
          {check.urls && check.urls.length > 0 && (
            <div style={{ marginBottom: 6 }}><b>Где:</b> {check.urls.slice(0, 8).map(u => <span key={u} style={{ display: "block", wordBreak: "break-all" }}>{u}</span>)}{check.urls.length > 8 && <span>… и ещё {check.urls.length - 8}</span>}</div>
          )}
          {check.snippet && <pre style={{ background: "var(--muted)", padding: 10, borderRadius: 8, overflowX: "auto", fontSize: 11, margin: 0 }}>{check.snippet}</pre>}
        </div>
      )}
    </div>
  );
}

function AnswerRow({ a }: { a: ProbeAnswer }) {
  const [open, setOpen] = useState(false);
  const tone = a.unavailable ? "var(--muted-foreground)" : a.mentioned ? "var(--success)" : "var(--destructive)";
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 11, fontWeight: 700, color: tone, whiteSpace: "nowrap", minWidth: 96 }}>{PROBE_LLM_LABELS[a.llm]}</span>
        <div style={{ flex: 1, fontSize: 12, color: "var(--foreground)" }}>{a.prompt}</div>
        <span style={{ fontSize: 11, color: tone, whiteSpace: "nowrap" }}>
          {a.unavailable ? "нет ответа" : a.mentioned ? (a.citedUs ? "назвал и процитировал" : "назвал") : "не назвал"}
        </span>
      </div>
      {open && !a.unavailable && (
        <div style={{ marginLeft: 106, marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "var(--foreground-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.55, background: "var(--muted)", padding: 10, borderRadius: 8, maxHeight: 320, overflowY: "auto" }}>{a.answer}</div>
          {a.citations.length > 0 && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>Источники: {a.citations.join(", ")}</div>}
          {a.brandsNamed.length > 0 && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Названы: {a.brandsNamed.join(", ")}</div>}
        </div>
      )}
    </div>
  );
}

function Artifact({ title, text, hint }: { title: string; text?: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{title}</div>
          {hint && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{hint}</div>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <CopyButton text={text} />
          <button className="ds-btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setOpen(o => !o)}>{open ? "Свернуть" : "Показать"}</button>
        </div>
      </div>
      {open && <pre style={{ background: "var(--muted)", padding: 10, borderRadius: 8, overflowX: "auto", fontSize: 11, margin: "10px 0 0", maxHeight: 360, overflowY: "auto", whiteSpace: "pre-wrap" }}>{text}</pre>}
    </div>
  );
}

function PlanRow({ item, index }: { item: ActionItem; index: number }) {
  const [open, setOpen] = useState(index <= 3);
  const prColor = item.priority === 1 ? "var(--destructive)" : item.priority === 2 ? "#f59e0b" : "var(--muted-foreground)";
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 11, fontWeight: 700, color: prColor, minWidth: 22, marginTop: 2 }}>#{index}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{item.title}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            {GEO_PILLAR_LABELS[item.pillar]} · влияние: {IMPACT_LABEL[item.impact]} · усилия: {EFFORT_LABEL[item.effort]}
          </div>
        </div>
        <span style={{ color: "var(--muted-foreground)" }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </div>
      {open && (
        <div style={{ marginLeft: 32, marginTop: 8, fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.55 }}>
          <div style={{ marginBottom: 6 }}><b>Почему:</b> {item.why}</div>
          <div style={{ marginBottom: 6 }}><b>Что делать:</b> {item.howTo}</div>
          {item.urls && item.urls.length > 0 && <div style={{ marginBottom: 6, wordBreak: "break-all" }}><b>Где:</b> {item.urls.slice(0, 6).join(", ")}{item.urls.length > 6 ? ` … ещё ${item.urls.length - 6}` : ""}</div>}
          {item.snippet && (
            <div>
              <pre style={{ background: "var(--muted)", padding: 10, borderRadius: 8, overflowX: "auto", fontSize: 11, margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{item.snippet}</pre>
              <CopyButton text={item.snippet} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GeoAuditView({ analysis, userId, onWriteArticle, initialReport }: Props) {
  const [url, setUrl] = useState(analysis?.company?.url ?? "");
  const [brand, setBrand] = useState(analysis?.company?.name ?? "");
  const [niche, setNiche] = useState(analysis?.company?.description?.split(/[.!?]/)[0]?.slice(0, 120) ?? "");
  const [withVisibility, setWithVisibility] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [report, setReport] = useState<GeoReport | null>(initialReport ?? null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<GeoRunSnapshot[]>([]);
  const [prompts, setPrompts] = useState<GeoPrompt[]>([]);
  const [promptsDirty, setPromptsDirty] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [agentSaved, setAgentSaved] = useState<"idle" | "saving" | "ok" | "err">("idle");

  // Последний полный отчёт — из localStorage; история и промпты — с сервера.
  useEffect(() => {
    if (initialReport) return;
    try {
      const raw = localStorage.getItem(LAST_KEY(userId));
      if (raw) {
        const cached = JSON.parse(raw) as GeoReport;
        if (cached?.version === 1) {
          setReport(cached);
          if (!url) setUrl(cached.input.websiteUrl);
          if (!brand && cached.crawl?.brandName) setBrand(cached.crawl.brandName);
        }
      }
    } catch { /* повреждённый кэш — просто начнём заново */ }
    let cancelled = false;
    (async () => {
      const all = await loadAllFromServer();
      if (cancelled || !all) return;
      const h = all[HISTORY_KEY];
      if (Array.isArray(h)) setHistory(h as GeoRunSnapshot[]);
      const p = all[PROMPTS_KEY];
      if (Array.isArray(p)) setPrompts(p as GeoPrompt[]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!loading || startedAt == null) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [loading, startedAt]);

  const persistHistory = useCallback(async (r: GeoReport) => {
    const next = [toSnapshot(r), ...history.filter(s => s.createdAt !== r.createdAt)].slice(0, HISTORY_MAX);
    setHistory(next);
    await syncToServer(HISTORY_KEY, next);
  }, [history]);

  const run = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(""); setStartedAt(Date.now()); setElapsed(0);
    try {
      const res = await fetch("/api/geo-agent/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: url.trim(),
          brandName: brand.trim() || undefined,
          niche: niche.trim() || undefined,
          maxPages: 12,
          skipVisibility: !withVisibility,
          // Свой промпт-банк = тот же набор из месяца в месяц; иначе агент сгенерирует.
          prompts: prompts.length ? prompts.map(p => p.text) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const r = data.report as GeoReport;
      setReport(r);
      try { localStorage.setItem(LAST_KEY(userId), JSON.stringify(r)); } catch { /* квота localStorage — не критично */ }
      await persistHistory(r);
      // Первый прогон без своего банка — забираем сгенерированные промпты как основу.
      if (!prompts.length && r.visibility?.prompts?.length) {
        setPrompts(r.visibility.prompts);
        setPromptsDirty(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setStartedAt(null);
    }
  };

  const savePrompts = async () => {
    setAgentSaved("saving");
    try {
      await syncToServer(PROMPTS_KEY, prompts);
      // Тот же набор — в конфиг месячного агента, чтобы «было/стало» считалось по одним вопросам.
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: "geo-agent", params: { prompts: prompts.map(p => p.text), websiteUrl: url.trim() || undefined, brandName: brand.trim() || undefined, niche: niche.trim() || undefined } }),
      });
      setAgentSaved(res.ok ? "ok" : "err");
      setPromptsDirty(false);
    } catch {
      setAgentSaved("err");
    }
    setTimeout(() => setAgentSaved("idle"), 2500);
  };

  const addPrompt = () => {
    const t = newPrompt.trim();
    if (!t) return;
    const intent: GeoPrompt["intent"] = /сравн|или|vs|лучше/i.test(t) ? "compare" : /сколько|цен|стоим/i.test(t) ? "price" : /как выбрать|на что смотреть/i.test(t) ? "howto" : /что такое/i.test(t) ? "define" : brand && t.toLowerCase().includes(brand.toLowerCase()) ? "brand" : "recommend";
    setPrompts(ps => [...ps, { text: t, intent }]);
    setNewPrompt("");
    setPromptsDirty(true);
  };

  const writeArticle = (p: GeoPrompt) => {
    try { localStorage.setItem(GEO_HANDOFF_KEY(userId), JSON.stringify(handoffFromPrompt(p, brand))); } catch { /* */ }
    onWriteArticle?.();
  };

  const checksByPillar = useMemo(() => {
    const map = new Map<GeoPillar, GeoCheck[]>();
    for (const p of PILLARS) map.set(p, []);
    for (const ch of report?.checks ?? []) map.get(ch.pillar)?.push(ch);
    return map;
  }, [report]);

  const plan = report?.plan ?? [];
  const vis = report?.visibility;
  const unanswered = useMemo(() => {
    if (!vis) return [] as GeoPrompt[];
    const set = new Set(vis.unansweredPrompts.map(p => p.text));
    return (prompts.length ? prompts : vis.prompts).filter(p => set.has(p.text));
  }, [vis, prompts]);

  const downloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `geo-audit-${report.crawl.domain}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const prev = history.find(h => report && h.createdAt !== report.createdAt && h.domain === report.crawl.domain);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
            <Radar size={22} /> GEO-аудит сайта
          </div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
            Читают ли сайт краулеры ассистентов, извлекаем ли контент, кого ChatGPT и Gemini цитируют вместо вас — и что чинить первым
          </div>
        </div>
      </div>

      <div className="ds-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr", gap: 10, marginBottom: 10 }}>
          <input className="ds-input" placeholder="https://example.ru" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} />
          <input className="ds-input" placeholder="Бренд" value={brand} onChange={e => setBrand(e.target.value)} />
          <input className="ds-input" placeholder="Ниша — чем занимается компания (для вопросов ассистентам)" value={niche} onChange={e => setNiche(e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--foreground-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={withVisibility} onChange={e => setWithVisibility(e.target.checked)} />
            Опросить ассистентов (ChatGPT, Gemini, Claude…) — дольше на 1–2 минуты, но это и есть ответ на вопрос «называют ли нас»
          </label>
          <button className="ds-btn ds-btn-primary" onClick={run} disabled={loading || !url.trim()}>
            {loading ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Проверяем… {elapsed}с</> : <><Radar size={14} /> Запустить аудит</>}
          </button>
        </div>
        {loading && (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>
            Обходим до 12 страниц двумя краулерами, проверяем robots/llms.txt/sitemap, индекс Bing{withVisibility ? `, задаём ассистентам ${prompts.length || "8"} вопросов клиентов` : ""}. Обычно 1–3 минуты.
          </div>
        )}
        {err && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>

      {/* История прогонов — «было/стало» */}
      {history.length > 0 && (
        <Section title={`Динамика — ${history.length} ${history.length === 1 ? "прогон" : "прогонов"}`} subtitle="Скор и доля ответов с брендом по одному и тому же набору промптов. Сохраняется в аккаунте." defaultOpen={history.length > 1}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--muted-foreground)", textAlign: "left" }}>
                  <th style={{ padding: "4px 8px 6px 0" }}>Дата</th><th style={{ padding: "4px 8px" }}>Сайт</th><th style={{ padding: "4px 8px" }}>Скор</th>
                  {PILLARS.map(p => <th key={p} style={{ padding: "4px 8px", fontWeight: 500 }}>{GEO_PILLAR_LABELS[p].split(" ")[0]}</th>)}
                  <th style={{ padding: "4px 8px" }}>Назван</th><th style={{ padding: "4px 8px" }}>Цитируют вместо нас</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.createdAt} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap" }}>{new Date(h.createdAt).toLocaleDateString("ru-RU")}</td>
                    <td style={{ padding: "6px 8px" }}>{h.domain}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: scoreColor(h.score) }}>{h.score}</td>
                    {PILLARS.map(p => <td key={p} style={{ padding: "6px 8px", color: scoreColor(h.pillars[p]) }}>{h.pillars[p] < 0 ? "н/д" : h.pillars[p]}</td>)}
                    <td style={{ padding: "6px 8px" }}>{h.mentionRate == null ? "н/д" : `${h.mentionRate}%`}</td>
                    <td style={{ padding: "6px 8px", color: "var(--muted-foreground)" }}>{h.citedInstead.slice(0, 4).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Промпт-банк */}
      <Section
        title={`Промпт-банк — ${prompts.length} вопросов`}
        subtitle="Вопросы клиентов, по которым меряем каждый месяц. Один и тот же набор — иначе «было/стало» нечестное. Этот же список уходит в месячный агент."
        defaultOpen={prompts.length > 0 || !!vis}
        right={
          <button className="ds-btn ds-btn-primary" style={{ fontSize: 12, padding: "5px 10px", display: "inline-flex", gap: 6, alignItems: "center" }} onClick={savePrompts} disabled={agentSaved === "saving" || prompts.length === 0}>
            <Save size={12} /> {agentSaved === "saving" ? "Сохраняем…" : agentSaved === "ok" ? "Сохранено" : agentSaved === "err" ? "Ошибка" : promptsDirty ? "Сохранить в агент" : "Сохранено в агент"}
          </button>
        }
      >
        {prompts.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
            Пусто. Запустите аудит с опросом ассистентов — сгенерированные вопросы появятся здесь, их можно править и дополнять.
            {vis?.prompts?.length ? <> <button className="ds-btn" style={{ fontSize: 12, padding: "3px 8px" }} onClick={() => { setPrompts(vis.prompts); setPromptsDirty(true); }}>Взять из аудита ({vis.prompts.length})</button></> : null}
          </div>
        )}
        {prompts.map((p, i) => {
          const missed = unanswered.some(u => u.text === p.text);
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--border)", padding: "6px 0", fontSize: 12 }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "var(--muted)", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{INTENT_LABEL[p.intent]}</span>
              <span style={{ flex: 1, color: "var(--foreground)" }}>{p.text}</span>
              {vis && <span style={{ fontSize: 11, color: missed ? "var(--destructive)" : "var(--success)", whiteSpace: "nowrap" }}>{missed ? "не названы" : "названы"}</span>}
              {missed && onWriteArticle && (
                <button className="ds-btn" style={{ fontSize: 11, padding: "3px 8px", display: "inline-flex", gap: 4, alignItems: "center" }} onClick={() => writeArticle(p)} title="Открыть генератор статьи в GEO-режиме с этой темой">
                  <FileText size={11} /> Статья
                </button>
              )}
              <button className="ds-btn" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => { setPrompts(ps => ps.filter((_, j) => j !== i)); setPromptsDirty(true); }} title="Убрать">×</button>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input className="ds-input" style={{ flex: 1 }} placeholder="Добавить вопрос так, как его задал бы клиент ассистенту…" value={newPrompt} onChange={e => setNewPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && addPrompt()} />
          <button className="ds-btn" onClick={addPrompt} disabled={!newPrompt.trim()}><ListChecks size={14} /> Добавить</button>
        </div>
      </Section>

      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {/* Скор */}
          <div className="ds-card">
            <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center", minWidth: 120 }}>
                <div style={{ fontSize: 44, fontWeight: 800, color: scoreColor(report.score.total), lineHeight: 1 }}>{report.score.total}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>из 100 · {report.crawl.domain}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(report.createdAt).toLocaleString("ru-RU")}</div>
                {prev && <div style={{ fontSize: 11, marginTop: 4, color: report.score.total >= prev.score ? "var(--success)" : "var(--destructive)" }}>{report.score.total >= prev.score ? "▲" : "▼"} {Math.abs(report.score.total - prev.score)} к прошлому ({prev.score})</div>}
              </div>
              <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 8 }}>
                {PILLARS.map(p => {
                  const v = report.score.pillars[p];
                  return (
                    <div key={p}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: "var(--foreground)" }}>{GEO_PILLAR_LABELS[p]}</span>
                        <span style={{ color: scoreColor(v), fontWeight: 700 }}>{v < 0 ? "н/д" : v}{prev && prev.pillars[p] >= 0 && v >= 0 && v !== prev.pillars[p] ? <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}> ({v > prev.pillars[p] ? "+" : ""}{v - prev.pillars[p]})</span> : null}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "var(--muted)" }}>
                        <div style={{ width: `${Math.max(0, v)}%`, height: "100%", borderRadius: 3, background: scoreColor(v), transition: "width .3s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="ds-btn" style={{ fontSize: 12 }} onClick={downloadJson}><Download size={12} /> JSON</button>
              </div>
            </div>
            {report.limitations.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                <b>Не проверено:</b> {report.limitations.join(" ")}
              </div>
            )}
          </div>

          {/* План */}
          <Section title={`План действий — ${plan.length} пунктов`} subtitle="Сначала то, без чего остальное не работает: доступность → извлекаемость → сущность → свежесть → внешние сигналы">
            {plan.length === 0 && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Провалов нет — все проверки пройдены.</div>}
            {plan.map((item, i) => <PlanRow key={item.id} item={item} index={i + 1} />)}
          </Section>

          {/* Видимость */}
          {vis && vis.answers.length > 0 && (
            <Section
              title={`Что ответили ассистенты — бренд назван в ${vis.mentionRate}% ответов`}
              subtitle={`Проверено: ${vis.llmsChecked.map(l => PROBE_LLM_LABELS[l]).join(", ")}${vis.llmsUnavailable.length ? ` · без ключа: ${vis.llmsUnavailable.map(l => PROBE_LLM_LABELS[l]).join(", ")}` : ""}`}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
                {Object.entries(vis.byLlm).map(([llm, s]) => (
                  <div key={llm} style={{ textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.checked ? scoreColor(Math.round(s.mentioned / s.checked * 100)) : "var(--muted-foreground)" }}>
                      {s.checked ? `${Math.round(s.mentioned / s.checked * 100)}%` : "н/д"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{PROBE_LLM_LABELS[llm as keyof typeof PROBE_LLM_LABELS] ?? llm} · {s.checked} отв.{s.cited ? ` · цитат: ${s.cited}` : ""}</div>
                  </div>
                ))}
              </div>
              {vis.citedDomains.filter(d => !d.isUs).length > 0 && (
                <div style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
                  <b>Кого цитируют вместо вас</b> — это список площадок для размещений:{" "}
                  {vis.citedDomains.filter(d => !d.isUs).slice(0, 12).map(d => (
                    <span key={d.domain} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 10, background: "var(--muted)", marginRight: 6, marginBottom: 4 }}>
                      {d.domain} <span style={{ opacity: .6 }}>×{d.count}</span>
                    </span>
                  ))}
                </div>
              )}
              {vis.competitorsNamed.length > 0 && (
                <div style={{ marginBottom: 12, fontSize: 12 }}><b>Кого называют:</b> {vis.competitorsNamed.slice(0, 8).map(c => `${c.name} (${c.count})`).join(", ")}</div>
              )}
              {unanswered.length > 0 && onWriteArticle && (
                <div style={{ marginBottom: 12, fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "var(--muted)" }}>
                  <b>{unanswered.length} {unanswered.length === 1 ? "вопрос" : "вопросов"} без нас.</b> Под каждый можно сразу написать сравнительную страницу или FAQ — кнопка «Статья» в промпт-банке выше. Статья пишется в GEO-режиме под конкретный вопрос, а не «на тему».
                </div>
              )}
              {vis.answers.map((a, i) => <AnswerRow key={i} a={a} />)}
            </Section>
          )}

          {/* Проверки по опорам */}
          {PILLARS.map(p => {
            const list = checksByPillar.get(p) ?? [];
            if (!list.length) return null;
            const v = report.score.pillars[p];
            return (
              <Section key={p} title={GEO_PILLAR_LABELS[p]} subtitle={`${list.filter(c => c.status === "pass").length} из ${list.filter(c => c.status !== "na").length} проверок пройдено`} defaultOpen={v >= 0 && v < 75}
                right={<span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(v) }}>{v < 0 ? "н/д" : `${v}/100`}</span>}>
                {list.map(ch => <CheckRow key={ch.key} check={ch} />)}
              </Section>
            );
          })}

          {/* Артефакты */}
          <Section title="Готовые артефакты" subtitle="Черновики для вставки. Без ключа Claude FAQ и капсулы — шаблоны с плейсхолдерами; цифры туда подставляете вы." defaultOpen={false}>
            <Artifact title="llms.txt" hint="По реальным страницам сайта. Эффект на цитируемость не доказан, но и вреда нет — 5 минут." text={report.artifacts.llmsTxt} />
            <Artifact title="robots.txt — блок для краулеров ассистентов" hint="16 ботов: ответы, поиск, обучение — сгруппированы с комментариями" text={report.artifacts.robotsAiBlock} />
            <Artifact title="Organization JSON-LD" hint="С объединённым sameAs из найденных профилей" text={report.artifacts.organizationJsonLd} />
            <Artifact title="FAQPage JSON-LD" text={report.artifacts.faqJsonLd} />
            {report.artifacts.faq.length > 0 && (
              <Artifact title={`FAQ-черновики — ${report.artifacts.faq.length}`} hint="По промптам, где вас никто не назвал"
                text={report.artifacts.faq.map(f => `В: ${f.question}\nО: ${f.answer}${f.fromPrompt ? `\n(из промпта: ${f.fromPrompt})` : ""}`).join("\n\n")} />
            )}
            {report.artifacts.capsules.length > 0 && (
              <Artifact title={`Answer-капсулы — ${report.artifacts.capsules.length} страниц`} hint="Первый абзац 40–70 слов вместо крючка"
                text={report.artifacts.capsules.map(cp => `${cp.url}\nСейчас: ${cp.current}\nПредлагается: ${cp.proposed}${cp.proposedH1 ? `\nH1: ${cp.proposedH1}` : ""}`).join("\n\n")} />
            )}
            {report.artifacts.placementTargets.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "10px 0", fontSize: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>Площадки для размещений</div>
                {report.artifacts.placementTargets.map(t => (
                  <div key={t.domain} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0" }}>
                    <a href={`https://${t.domain}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", display: "inline-flex", gap: 4, alignItems: "center" }}>{t.domain} <ExternalLink size={11} /></a>
                    <span style={{ color: "var(--muted-foreground)" }}>×{t.count} · {t.kind}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
