"use client";

/**
 * PriceTrackingView — мониторинг цен конкурентов.
 *
 * - Список отслеживаемых товаров (URL, цена, конкурент, статус последнего скана)
 * - Кнопка «Добавить URL» → форма
 * - На каждом товаре: «Проверить сейчас», «Удалить», «История» (раскрытие графика)
 * - Глобальная кнопка «Запустить скан всех» (вызов /api/cron/check-prices)
 *
 * Сами уведомления уходят в Telegram через серверный sendPriceAlert.
 */

import React, { useEffect, useState } from "react";
import {
  LineChart, Loader2, Plus, RefreshCw, Trash2, X, ExternalLink, AlertCircle,
  CheckCircle2, TrendingDown, TrendingUp, Minus, Upload,
} from "lucide-react";

interface TrackedProduct {
  id: string;
  product_url: string;
  product_name: string | null;
  competitor_name: string | null;
  currency: string;
  last_price: number | null;
  last_checked_at: string | null;
  check_status: string;
  check_error: string | null;
  notify_telegram: boolean;
  threshold_pct: number | null;
  created_at: string;
}

interface HistoryPoint { price: number; currency: string; checked_at: string }

export function PriceTrackingView() {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [thresholdPct, setThresholdPct] = useState<string>("");
  const [cssSelector, setCssSelector] = useState("");
  // Bulk CSV import
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, errors: [] as string[] });

  /**
   * Парсит CSV/TSV (или просто список URL по строке) и добавляет товары
   * по одному через тот же endpoint. Кладёт прогресс в bulkProgress.
   *
   * Поддерживаемые форматы строк:
   *   - просто URL
   *   - URL,competitor_name
   *   - URL,competitor_name,threshold_pct
   *   - URL,competitor_name,threshold_pct,css_selector
   * Разделитель — запятая ИЛИ табуляция. Шапку (URL/Конкурент…) автоматически
   * пропускаем.
   */
  const handleBulkImport = async () => {
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: 0, errors: [] });
    const errors: string[] = [];
    try {
      const rawLines = bulkCsv
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
      // Skip header line if it doesn't start with http
      const lines = rawLines.filter((l, i) => !(i === 0 && !/^https?:\/\//i.test(l)));
      setBulkProgress({ done: 0, total: lines.length, errors: [] });

      let done = 0;
      for (const line of lines) {
        const sep = line.includes("\t") ? "\t" : ",";
        const parts = line.split(sep).map(s => s.trim());
        const lineUrl = parts[0];
        if (!/^https?:\/\//i.test(lineUrl)) {
          errors.push(`${lineUrl || "(пустой URL)"} — не URL`);
          done++; setBulkProgress({ done, total: lines.length, errors: [...errors] });
          continue;
        }
        const compName = parts[1] || undefined;
        const threshold = parts[2] ? Number(parts[2]) : undefined;
        const selector = parts[3] || undefined;
        try {
          const r = await fetch("/api/price-tracking", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_url: lineUrl,
              competitor_name: compName,
              threshold_pct: Number.isFinite(threshold) ? threshold : undefined,
              css_selector: selector,
              notify_telegram: true,
            }),
          });
          const j = await r.json();
          if (!j.ok) errors.push(`${lineUrl} — ${j.error ?? "ошибка"}`);
        } catch (e) {
          errors.push(`${lineUrl} — ${e instanceof Error ? e.message : "ошибка"}`);
        }
        done++;
        setBulkProgress({ done, total: lines.length, errors: [...errors] });
      }
      await load();
      // Если все ok — закрываем форму через секунду
      if (errors.length === 0) {
        setTimeout(() => {
          setBulkOpen(false);
          setBulkCsv("");
          setBulkProgress({ done: 0, total: 0, errors: [] });
        }, 1500);
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => setBulkCsv(text));
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/price-tracking", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setProducts(j.products);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!/^https?:\/\//i.test(url.trim())) {
      setError("Введите полный URL начиная с https://");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const r = await fetch("/api/price-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_url: url.trim(),
          competitor_name: competitorName.trim() || undefined,
          threshold_pct: thresholdPct ? Number(thresholdPct) : undefined,
          css_selector: cssSelector.trim() || undefined,
          notify_telegram: true,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "Ошибка");
      setProducts(prev => [j.product, ...prev]);
      setUrl(""); setCompetitorName(""); setThresholdPct(""); setCssSelector("");
      setShowAddForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setAdding(false); }
  };

  const handleCheck = async (id: string) => {
    setBusyId(id);
    try {
      const r = await fetch(`/api/price-tracking/${id}/check`, { method: "POST" });
      const j = await r.json();
      if (j.ok && j.product) {
        setProducts(prev => prev.map(p => p.id === id ? j.product : p));
      }
    } finally { setBusyId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить отслеживание этого товара?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/price-tracking/${id}`, { method: "DELETE" });
      setProducts(prev => prev.filter(p => p.id !== id));
    } finally { setBusyId(null); }
  };

  return (
    <div style={{ maxWidth: 1180 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 12, letterSpacing: -0.5 }}>
            <LineChart size={26} /> Мониторинг цен
          </h1>
          <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5, maxWidth: 700 }}>
            Отслеживаем цены конкурентов. Каждое утро система обходит все товары, при изменении цены приходит уведомление в Telegram.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setBulkOpen(v => !v)}
            style={{
              padding: "11px 18px", borderRadius: 10,
              border: "1.5px solid var(--border)", background: "transparent",
              color: "var(--foreground)", fontSize: 14, fontWeight: 700,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              minHeight: 44,
            }}>
            <Upload size={15}/> CSV-импорт
          </button>
          <button
            onClick={() => setShowAddForm(v => !v)}
            style={{
              padding: "11px 20px", borderRadius: 10, border: "none",
              background: "var(--primary)", color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
              minHeight: 44,
            }}>
            {showAddForm ? <><X size={16}/> Закрыть</> : <><Plus size={16}/> Добавить товар</>}
          </button>
        </div>
      </div>

      {/* Bulk CSV import form */}
      {bulkOpen && (
        <div style={{
          background: "var(--card)", border: "1.5px solid color-mix(in oklch, var(--primary) 30%, var(--border))",
          borderRadius: 14, padding: 22, marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>Массовый импорт товаров</div>
            <button onClick={() => setBulkOpen(false)} style={{ background: "transparent", border: "none", color: "var(--muted-foreground)", cursor: "pointer", padding: 4 }}>
              <X size={18} />
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 14px", lineHeight: 1.55 }}>
            Вставьте список товаров — по одному на строку. Поддерживаемые форматы:
            <br/>
            <code style={{ background: "var(--muted)", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>URL</code> · {" "}
            <code style={{ background: "var(--muted)", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>URL,Конкурент</code> · {" "}
            <code style={{ background: "var(--muted)", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>URL,Конкурент,порог%,css-селектор</code>
            <br/>
            Разделитель — запятая или табуляция. Шапку CSV распознаём автоматически.
          </p>
          <textarea
            value={bulkCsv}
            onChange={e => setBulkCsv(e.target.value)}
            disabled={bulkBusy}
            placeholder={`https://wildberries.ru/catalog/123456/detail.aspx,Wildberries,5\nhttps://ozon.ru/product/456,Ozon\nhttps://shop.example.ru/item-789`}
            rows={8}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: `1.5px solid var(--border)`, background: "var(--background)",
              color: "var(--foreground)", fontSize: 13, fontFamily: "monospace",
              outline: "none", resize: "vertical", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={handleBulkImport}
              disabled={bulkBusy || !bulkCsv.trim()}
              style={{
                padding: "11px 22px", borderRadius: 10, border: "none",
                background: bulkBusy || !bulkCsv.trim() ? "var(--muted)" : "var(--primary)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: bulkBusy || !bulkCsv.trim() ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
              }}
            >
              {bulkBusy
                ? <><Loader2 size={15} className="mr-spin" /> Импортирую {bulkProgress.done}/{bulkProgress.total}…</>
                : <><Upload size={15}/> Загрузить</>}
            </button>
            <label style={{
              padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)",
              background: "transparent", color: "var(--foreground)",
              fontSize: 13, fontWeight: 600, cursor: bulkBusy ? "not-allowed" : "pointer",
              minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6, opacity: bulkBusy ? 0.6 : 1,
            }}>
              Открыть CSV-файл
              <input type="file" accept=".csv,.tsv,.txt" disabled={bulkBusy} onChange={handleBulkFile} style={{ display: "none" }} />
            </label>
            {bulkProgress.total > 0 && !bulkBusy && bulkProgress.errors.length === 0 && (
              <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                ✓ Добавлено {bulkProgress.done} товаров
              </span>
            )}
          </div>
          {bulkProgress.errors.length > 0 && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "color-mix(in oklch, var(--destructive) 8%, transparent)", border: "1px solid color-mix(in oklch, var(--destructive) 25%, transparent)", maxHeight: 200, overflow: "auto" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 6 }}>
                Не добавлены ({bulkProgress.errors.length}):
              </div>
              {bulkProgress.errors.map((err, i) => (
                <div key={i} style={{ fontSize: 11.5, color: "var(--foreground-secondary)", marginBottom: 3 }}>
                  · {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div style={{
          background: "var(--card)", border: "1.5px solid color-mix(in oklch, var(--primary) 30%, var(--border))",
          borderRadius: 14, padding: 22, marginBottom: 24,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: "var(--foreground)" }}>Добавить товар для отслеживания</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            <div>
              <label style={lbl}>URL товара <span style={{ color: "#dc2626" }}>*</span></label>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/product/123"
                style={inp} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={lbl}>Конкурент / магазин <span style={{ color: "var(--muted-foreground)" }}>(опционально)</span></label>
                <input type="text" value={competitorName} onChange={e => setCompetitorName(e.target.value)}
                  placeholder="Wildberries / Ozon / название"
                  style={inp} />
              </div>
              <div>
                <label style={lbl}>Порог изменения, % <span style={{ color: "var(--muted-foreground)" }}>(оповещать при ≥)</span></label>
                <input type="number" min="0" step="0.5" value={thresholdPct} onChange={e => setThresholdPct(e.target.value)}
                  placeholder="0 = на любое изменение"
                  style={inp} />
              </div>
            </div>
            <details>
              <summary style={{ fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer", padding: "4px 0" }}>
                Продвинутые настройки
              </summary>
              <div style={{ marginTop: 10 }}>
                <label style={lbl}>Кастомный CSS-селектор для цены <span style={{ color: "var(--muted-foreground)" }}>(если автоопределение не работает)</span></label>
                <input type="text" value={cssSelector} onChange={e => setCssSelector(e.target.value)}
                  placeholder=".product-price__current"
                  style={{ ...inp, fontFamily: "monospace" }} />
              </div>
            </details>
            {error && (
              <div style={{ fontSize: 13, color: "var(--destructive)", padding: "10px 14px", background: "color-mix(in oklch, var(--destructive) 8%, transparent)", borderRadius: 10 }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={handleAdd} disabled={adding || !url.trim()}
                style={{
                  padding: "11px 22px", borderRadius: 10, border: "none",
                  background: adding || !url.trim() ? "var(--muted)" : "var(--primary)",
                  color: "#fff", fontSize: 14, fontWeight: 700,
                  cursor: adding || !url.trim() ? "not-allowed" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
                }}>
                {adding ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Сканируем цену…</> : <><Plus size={15}/> Добавить</>}
              </button>
              <button onClick={() => setShowAddForm(false)}
                style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--muted-foreground)" }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }}/>
        </div>
      ) : products.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "56px 32px", textAlign: "center" }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: "color-mix(in oklch, var(--primary) 12%, transparent)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <LineChart size={36} strokeWidth={1.5}/>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginBottom: 10 }}>Пока ничего не отслеживается</div>
          <div style={{ fontSize: 15, color: "var(--foreground-secondary)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto 22px" }}>
            Добавьте URL товара конкурента — система каждый день будет проверять цену и пришлёт уведомление в Telegram при изменении.
          </div>
          <button onClick={() => setShowAddForm(true)}
            style={{ padding: "12px 22px", borderRadius: 12, background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Plus size={16}/> Добавить первый товар
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {products.map(p => (
            <ProductRow key={p.id} product={p} busy={busyId === p.id} onCheck={() => handleCheck(p.id)} onDelete={() => handleDelete(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)",
  letterSpacing: "0.04em", marginBottom: 6, textTransform: "uppercase",
};
const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid var(--border)", background: "var(--background)",
  color: "var(--foreground)", fontSize: 14, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
};

function ProductRow({ product, busy, onCheck, onDelete }: {
  product: TrackedProduct; busy: boolean; onCheck: () => void; onDelete: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async () => {
    if (history.length > 0) return;
    setLoadingHistory(true);
    try {
      const r = await fetch(`/api/price-tracking/${product.id}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok && Array.isArray(j.history)) setHistory(j.history);
    } finally { setLoadingHistory(false); }
  };

  // Тренд: сравниваем последнюю цену с предпоследней (если в history есть)
  const trend: { pct: number | null; direction: "up" | "down" | "flat" } = (() => {
    if (history.length < 2) return { pct: null, direction: "flat" };
    const sorted = [...history].sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());
    const cur = sorted[0].price;
    const prev = sorted[1].price;
    if (prev === 0 || cur === prev) return { pct: 0, direction: "flat" };
    const pct = ((cur - prev) / prev) * 100;
    return { pct, direction: pct > 0 ? "up" : "down" };
  })();

  const cur = product.currency === "RUB" ? "₽" : product.currency === "USD" ? "$" : product.currency === "EUR" ? "€" : product.currency;
  const fmt = (n: number | null) => n != null ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) : "—";

  const statusBadge = (() => {
    if (product.check_status === "ok") return <span style={{ ...badge, background: "#16a34a18", color: "#16a34a" }}><CheckCircle2 size={13}/> ok</span>;
    if (product.check_status === "failed") return <span style={{ ...badge, background: "#dc262618", color: "#dc2626" }}><AlertCircle size={13}/> ошибка</span>;
    return <span style={{ ...badge, background: "#94a3b818", color: "#64748b" }}>pending</span>;
  })();

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 18,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
            {product.competitor_name && (
              <span style={{ ...badge, background: "color-mix(in oklch, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                {product.competitor_name}
              </span>
            )}
            {statusBadge}
            {product.threshold_pct != null && (
              <span style={{ ...badge, background: "var(--background)", color: "var(--muted-foreground)" }}>
                алерт ≥ {product.threshold_pct}%
              </span>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 4, lineHeight: 1.35 }}>
            {product.product_name || "(название не определено)"}
          </div>
          <a href={product.product_url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: "var(--muted-foreground)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, wordBreak: "break-all" }}>
            <ExternalLink size={11}/> {product.product_url.length > 70 ? product.product_url.slice(0, 70) + "…" : product.product_url}
          </a>
          {product.check_error && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--destructive)" }}>
              ⚠ {product.check_error}
            </div>
          )}
        </div>

        {/* Price */}
        <div style={{ minWidth: 140, textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
            Текущая цена
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--foreground)", lineHeight: 1, letterSpacing: -0.5 }}>
            {fmt(product.last_price)} <span style={{ fontSize: 16, fontWeight: 700, color: "var(--muted-foreground)" }}>{cur}</span>
          </div>
          {trend.pct != null && (
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: trend.direction === "up" ? "#dc2626" : trend.direction === "down" ? "#16a34a" : "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {trend.direction === "up" ? <TrendingUp size={13}/> : trend.direction === "down" ? <TrendingDown size={13}/> : <Minus size={13}/>}
              {trend.pct > 0 ? "+" : ""}{trend.pct.toFixed(1)}%
            </div>
          )}
          {product.last_checked_at && (
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
              {new Date(product.last_checked_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignSelf: "flex-start" }}>
          <button onClick={onCheck} disabled={busy} title="Проверить сейчас"
            style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground-secondary)", fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> : <RefreshCw size={14}/>}
            Проверить
          </button>
          <button onClick={() => { setShowHistory(v => !v); if (!showHistory) loadHistory(); }} title="История"
            style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: showHistory ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent", color: showHistory ? "var(--primary)" : "var(--foreground-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <LineChart size={14}/>
          </button>
          <button onClick={onDelete} disabled={busy} title="Удалить"
            style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid color-mix(in oklch, var(--destructive) 30%, var(--border))", background: "transparent", color: "var(--destructive)", fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Trash2 size={14}/>
          </button>
        </div>
      </div>

      {/* History (sparkline) */}
      {showHistory && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          {loadingHistory ? (
            <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Загружаем историю…</div>
          ) : history.length < 2 ? (
            <div style={{ color: "var(--muted-foreground)", fontSize: 13, fontStyle: "italic" }}>
              Пока недостаточно данных для графика. Запустите ещё проверку или подождите следующего дня.
            </div>
          ) : (
            <PriceSparkline points={history} currency={cur} />
          )}
        </div>
      )}
    </div>
  );
}

const badge: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8,
};

function PriceSparkline({ points, currency }: { points: HistoryPoint[]; currency: string }) {
  // Сортируем по возрастанию даты
  const sorted = [...points].sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime());
  const prices = sorted.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 600;
  const h = 120;
  const stepX = sorted.length > 1 ? w / (sorted.length - 1) : w;
  const path = sorted.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p.price - min) / range) * (h - 20) - 10;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  const last = sorted[sorted.length - 1];
  const first = sorted[0];
  const change = first.price > 0 ? ((last.price - first.price) / first.price) * 100 : 0;
  const trendColor = change > 0 ? "#dc2626" : change < 0 ? "#16a34a" : "#94a3b8";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
          История цены ({sorted.length} замеров)
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          За весь период: <strong style={{ color: trendColor }}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</strong>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 120, background: "var(--background)", borderRadius: 10 }}>
        <path d={path} fill="none" stroke={trendColor} strokeWidth={2.5} strokeLinejoin="round" />
        {sorted.map((p, i) => {
          const x = i * stepX;
          const y = h - ((p.price - min) / range) * (h - 20) - 10;
          return <circle key={i} cx={x} cy={y} r={3} fill={trendColor} />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
        <span>{new Date(first.checked_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })} · {first.price.toLocaleString("ru-RU")} {currency}</span>
        <span>{new Date(last.checked_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })} · {last.price.toLocaleString("ru-RU")} {currency}</span>
      </div>
    </div>
  );
}
