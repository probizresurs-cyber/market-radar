"use client";

/**
 * Минимальная Toast-система без внешних зависимостей.
 *
 * Использование:
 *   1) В корне страницы (page.tsx) обернуть приложение в <ToastProvider>.
 *   2) Внутри любого клиент-компонента: const { toast } = useToast(); toast({ ... }).
 *
 * Поддерживает:
 *   - тип (success / error / info)
 *   - заголовок + описание
 *   - кнопку-действие (например, "Открыть готовые посты")
 *   - авто-скрытие через 5 секунд (отключается duration: 0)
 *
 * Tooltip-стиль: всплывает в правом нижнем углу, до 3 одновременно.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export interface ToastOptions {
  id?: string;
  kind?: ToastKind;
  title: string;
  description?: string;
  /** Текст и обработчик клика по action-кнопке. */
  action?: { label: string; onClick: () => void };
  /** Длительность в мс. 0 — не скрывать автоматически. По умолчанию 5000. */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "id" | "kind" | "title">> {
  description?: string;
  action?: ToastOptions["action"];
  duration: number;
}

interface ToastContext {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastContext | null>(null);

export function useToast(): ToastContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOptions): string => {
    const id = opts.id ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = {
      id,
      kind: opts.kind ?? "info",
      title: opts.title,
      description: opts.description,
      action: opts.action,
      duration: opts.duration ?? 5000,
    };
    setItems(prev => [...prev.slice(-2), item]); // не больше 3 одновременно
    return id;
  }, []);

  return (
    <Ctx.Provider value={{ toast, dismiss }}>
      {children}
      <Viewport items={items} dismiss={dismiss} />
    </Ctx.Provider>
  );
}

function Viewport({ items, dismiss }: { items: ToastItem[]; dismiss: (id: string) => void }) {
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes mr-toast-in {
          from { transform: translateY(20px) scale(0.96); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
      {items.map(t => (
        <ToastCard key={t.id} item={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  // Авто-закрытие
  useEffect(() => {
    if (item.duration <= 0) return;
    const t = setTimeout(onClose, item.duration);
    return () => clearTimeout(t);
  }, [item.duration, onClose]);

  const colors = {
    success: { bg: "rgba(22,163,74,0.96)", icon: <CheckCircle2 size={20} />, accent: "#16a34a" },
    error:   { bg: "rgba(220,38,38,0.96)", icon: <AlertCircle size={20} />, accent: "#dc2626" },
    info:    { bg: "rgba(99,102,241,0.96)", icon: <Info size={20} />, accent: "#6366f1" },
  }[item.kind];

  return (
    <div
      style={{
        pointerEvents: "auto",
        minWidth: 320,
        maxWidth: 420,
        padding: "12px 14px",
        borderRadius: 12,
        background: colors.bg,
        color: "#fff",
        boxShadow: "0 10px 30px rgba(0,0,0,0.30), 0 4px 8px rgba(0,0,0,0.20)",
        backdropFilter: "blur(8px)",
        animation: "mr-toast-in 0.22s cubic-bezier(0.22, 0.61, 0.36, 1)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div style={{ flexShrink: 0, paddingTop: 2 }}>{colors.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{item.title}</div>
        {item.description && (
          <div style={{ fontSize: 12.5, opacity: 0.92, lineHeight: 1.45, marginTop: 4 }}>
            {item.description}
          </div>
        )}
        {item.action && (
          <button
            onClick={() => { item.action!.onClick(); onClose(); }}
            style={{
              marginTop: 10,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            {item.action.label} →
          </button>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Закрыть"
        style={{
          flexShrink: 0,
          width: 24, height: 24,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.85)", padding: 0,
          borderRadius: 4,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
