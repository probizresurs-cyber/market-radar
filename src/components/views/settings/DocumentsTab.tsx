"use client";

/**
 * Settings → Документы — список счетов и актов пользователя.
 * Действия:
 *   - Сформировать счёт (выбор тарифа или произвольная сумма)
 *   - Скачать PDF / Открыть в браузере
 *   - Видеть статус оплаты
 *
 * Если у клиента не заполнены реквизиты — кнопка «Сформировать счёт»
 * блокируется и появляется CTA «Заполнить реквизиты».
 */

import React, { useEffect, useState } from "react";
import { FileText, Download, Loader2, Plus, AlertCircle, ExternalLink, CheckCircle2, Eye, X } from "lucide-react";

interface InvoiceItem {
  id: string;
  invoice_number: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "cancelled" | "expired";
  service_description: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

interface ActItem {
  id: string;
  act_number: string;
  invoice_number: string | null;
  amount: number;
  service_description: string;
  signed_at: string;
  created_at: string;
}

interface PricingItem {
  id: string;
  name: string;
  description: string | null;
  price_amount: number;
  type: "free" | "one_time" | "subscription";
}

const STATUS_LABEL: Record<InvoiceItem["status"], { label: string; color: string; bg: string }> = {
  draft:     { label: "Черновик",   color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  sent:      { label: "Ожидает оплаты", color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  paid:      { label: "Оплачен",    color: "#16a34a", bg: "rgba(22,163,74,0.14)" },
  cancelled: { label: "Отменён",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  expired:   { label: "Просрочен",  color: "#dc2626", bg: "rgba(220,38,38,0.14)" },
};

const fmtMoney = (n: number): string =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₽";

const fmtDate = (s: string): string =>
  new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

export function DocumentsTab() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [acts, setActs] = useState<ActItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [invR, actR] = await Promise.all([
        fetch("/api/invoices", { cache: "no-store" }).then(r => r.json()),
        fetch("/api/acts", { cache: "no-store" }).then(r => r.json()),
      ]);
      if (invR.ok) setInvoices(invR.invoices ?? []);
      if (actR.ok) setActs(actR.acts ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header card with CTA */}
      <div style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "color-mix(in srgb, var(--primary) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={18} style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>Счета и акты</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5, maxWidth: 460 }}>
                Здесь хранятся выставленные счета на оплату и акты выполненных работ.
                Счета формируются мгновенно, акт появляется после подтверждения оплаты.
              </div>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Plus size={14} /> Сформировать счёт
          </button>
        </div>
      </div>

      {/* Invoices */}
      <div style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          СЧЕТА НА ОПЛАТУ
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>({invoices.length})</span>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite", verticalAlign: "middle" }} /> Загрузка…
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            Счетов пока нет. Нажмите «Сформировать счёт», чтобы создать первый.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invoices.map(inv => {
              const st = STATUS_LABEL[inv.status];
              return (
                <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: 12, borderRadius: 10, border: "1px solid var(--border)", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{inv.invoice_number}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", marginLeft: "auto" }}>
                        {fmtMoney(inv.amount)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                      {inv.service_description}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                      Выставлен {fmtDate(inv.created_at)} · Срок оплаты до {fmtDate(inv.due_date)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <a href={`/api/invoices/${inv.id}/pdf?view=1`} target="_blank" rel="noopener noreferrer"
                       title="Открыть в браузере"
                       style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--foreground-secondary)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                      <Eye size={13} />
                    </a>
                    <a href={`/api/invoices/${inv.id}/pdf`} download
                       title="Скачать PDF"
                       style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: 8, background: "var(--primary)", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                      <Download size={13} /> PDF
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Acts */}
      <div style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          АКТЫ ВЫПОЛНЕННЫХ РАБОТ
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>({acts.length})</span>
        </div>
        {acts.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            Акты появятся автоматически после оплаты счетов.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {acts.map(act => (
              <div key={act.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: 12, borderRadius: 10, border: "1px solid var(--border)", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{act.act_number}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, color: "#16a34a", background: "rgba(22,163,74,0.14)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <CheckCircle2 size={11} /> Подписан
                    </span>
                    {act.invoice_number && (
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>к счёту {act.invoice_number}</span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", marginLeft: "auto" }}>
                      {fmtMoney(act.amount)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                    {act.service_description}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                    Подписан {fmtDate(act.signed_at)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`/api/acts/${act.id}/pdf?view=1`} target="_blank" rel="noopener noreferrer"
                     title="Открыть в браузере"
                     style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--foreground-secondary)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                    <Eye size={13} />
                  </a>
                  <a href={`/api/acts/${act.id}/pdf`} download
                     style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: 8, background: "var(--primary)", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                    <Download size={13} /> PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateInvoiceDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void reload(); }} />}
    </div>
  );
}

// ─── Dialog: Create invoice ─────────────────────────────────────────────────
function CreateInvoiceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [customDescription, setCustomDescription] = useState<string>("");
  const [loadingItems, setLoadingItems] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          // Прячем бесплатные позиции
          const list = (d.items ?? []).filter((i: PricingItem) => i.price_amount > 0);
          setItems(list);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, []);

  const create = async () => {
    setCreating(true);
    setError(null);

    const body: Record<string, unknown> = {};
    if (selected === "custom") {
      const amt = Number(customAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setError("Введите сумму больше нуля");
        setCreating(false);
        return;
      }
      body.amount = amt;
      body.service_description = customDescription.trim() || "Услуги доступа к платформе MarketRadar";
    } else if (selected) {
      body.pricingItemId = selected;
    } else {
      setError("Выберите тариф или укажите сумму");
      setCreating(false);
      return;
    }

    try {
      const r = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) {
        if (j.action === "open_requisites") {
          setError(j.error + " (откройте вкладку «Реквизиты»)");
        } else {
          setError(j.error || "Не удалось создать счёт");
        }
        return;
      }
      onCreated(j.invoice.id);
    } catch {
      setError("Ошибка сети");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 24, maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>Сформировать счёт</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 14, lineHeight: 1.5 }}>
          После создания счёт появится в списке. Перешлите PDF в свою бухгалтерию или
          оплатите по реквизитам с расчётного счёта.
          После поступления оплаты администратор пометит счёт оплаченным
          и автоматически выпустит акт выполненных работ.
        </div>

        {/* Tariffs */}
        {loadingItems ? (
          <div style={{ padding: 16, textAlign: "center" }}><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {items.map(it => (
              <label key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, cursor: "pointer", border: `2px solid ${selected === it.id ? "var(--primary)" : "var(--border)"}`, background: selected === it.id ? "color-mix(in srgb, var(--primary) 6%, transparent)" : "transparent" }}>
                <input type="radio" name="tariff" checked={selected === it.id} onChange={() => setSelected(it.id)} style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{it.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>{fmtMoney(it.price_amount)}</span>
                  </div>
                  {it.description && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{it.description}</div>}
                </div>
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, cursor: "pointer", border: `2px solid ${selected === "custom" ? "var(--primary)" : "var(--border)"}`, background: selected === "custom" ? "color-mix(in srgb, var(--primary) 6%, transparent)" : "transparent" }}>
              <input type="radio" name="tariff" checked={selected === "custom"} onChange={() => setSelected("custom")} style={{ marginTop: 3 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 6 }}>Произвольная сумма</div>
                {selected === "custom" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input type="number" min={1} value={customAmount} onChange={e => setCustomAmount(e.target.value)}
                      placeholder="Сумма, ₽"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    <input type="text" value={customDescription} onChange={e => setCustomDescription(e.target.value)}
                      placeholder="Описание услуги (опционально)"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
            </label>
          </div>
        )}

        {error && (
          <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: "color-mix(in srgb, var(--destructive) 10%, transparent)", color: "var(--destructive)", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 6 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={creating}
            style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Отмена
          </button>
          <button onClick={create} disabled={creating || (!selected)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: creating ? "wait" : "pointer", opacity: !selected ? 0.5 : 1 }}>
            {creating && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            Создать счёт
          </button>
        </div>
      </div>
    </div>
  );
}
