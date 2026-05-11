"use client";

/**
 * Content Calendar — month grid with drag-and-drop scheduling.
 *
 * Закрывает P0-пробел «нет календаря публикаций» из аудита платформы.
 * Юзер видит сетку месяца, перетаскивает свои GeneratedPost/Reel из
 * «банка не запланированного контента» в нужный день. Дата сохраняется
 * в `scheduledFor`, родительская страница пишет это в localStorage.
 *
 * Без сторонних DnD-библиотек — нативный HTML5 drag&drop. Это самое
 * совместимое решение для desktop. На mobile вместо drag предлагаем
 * кнопку «Запланировать на дату».
 */

import React, { useState, useMemo, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { GeneratedPost, GeneratedReel } from "@/lib/content-types";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Film,
  FileText,
  X,
  Image as ImageIcon,
  Inbox,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type SchedulableItem =
  | { kind: "post"; item: GeneratedPost }
  | { kind: "reel"; item: GeneratedReel };

const RU_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const RU_MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

// Build a 6-week (42-cell) grid for a given year/month, starting from Monday.
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // Day-of-week: 0=Sun → shift so Mon=0
  const startWeekday = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function dateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function ContentCalendarView({
  c,
  posts,
  reels,
  onUpdatePost,
  onUpdateReel,
  onGoToPost,
  onGoToReel,
}: {
  c: Colors;
  posts: GeneratedPost[];
  reels: GeneratedReel[];
  onUpdatePost: (post: GeneratedPost) => void;
  onUpdateReel: (reel: GeneratedReel) => void;
  onGoToPost?: (id: string) => void;
  onGoToReel?: (id: string) => void;
}) {
  void c;
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [dragItem, setDragItem] = useState<SchedulableItem | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<SchedulableItem | null>(null);

  // Build everything
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const scheduled: Map<string, SchedulableItem[]> = useMemo(() => {
    const map = new Map<string, SchedulableItem[]>();
    for (const p of posts) {
      if (!p.scheduledFor) continue;
      const k = dateKey(p.scheduledFor);
      const arr = map.get(k) ?? [];
      arr.push({ kind: "post", item: p });
      map.set(k, arr);
    }
    for (const r of reels) {
      if (!r.scheduledFor) continue;
      const k = dateKey(r.scheduledFor);
      const arr = map.get(k) ?? [];
      arr.push({ kind: "reel", item: r });
      map.set(k, arr);
    }
    return map;
  }, [posts, reels]);

  const unscheduled: SchedulableItem[] = useMemo(() => {
    const out: SchedulableItem[] = [];
    for (const p of posts) if (!p.scheduledFor) out.push({ kind: "post", item: p });
    for (const r of reels) if (!r.scheduledFor) out.push({ kind: "reel", item: r });
    // Newest first
    return out.sort(
      (a, b) =>
        new Date(b.item.generatedAt).getTime() -
        new Date(a.item.generatedAt).getTime(),
    );
  }, [posts, reels]);

  // ── Drag & drop handlers ───────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, it: SchedulableItem) => {
    setDragItem(it);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", `${it.kind}:${it.item.id}`);
    } catch { /* ignore */ }
  };
  const handleDragOver = (e: React.DragEvent, k: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverKey !== k) setDragOverKey(k);
  };
  const handleDropOnDate = (e: React.DragEvent, d: Date) => {
    e.preventDefault();
    if (!dragItem) return;
    const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString();
    if (dragItem.kind === "post") {
      onUpdatePost({ ...dragItem.item, scheduledFor: iso });
    } else {
      onUpdateReel({ ...dragItem.item, scheduledFor: iso });
    }
    setDragItem(null);
    setDragOverKey(null);
  };
  const handleDropOnBank = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragItem) return;
    if (dragItem.kind === "post") {
      const next = { ...dragItem.item };
      delete next.scheduledFor;
      onUpdatePost(next);
    } else {
      const next = { ...dragItem.item };
      delete next.scheduledFor;
      onUpdateReel(next);
    }
    setDragItem(null);
    setDragOverKey(null);
  };

  // ── Mobile fallback: schedule via date input ─────────────────────
  const handleScheduleViaInput = (it: SchedulableItem, isoDate: string) => {
    if (!isoDate) return;
    const iso = new Date(isoDate + "T12:00:00").toISOString();
    if (it.kind === "post") onUpdatePost({ ...it.item, scheduledFor: iso });
    else onUpdateReel({ ...it.item, scheduledFor: iso });
    setScheduleTarget(null);
  };

  // ── Navigation ────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  // Close openDate panel with Esc
  useEffect(() => {
    if (!openDate) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDate(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openDate]);

  const hasAnyContent = posts.length + reels.length > 0;

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            margin: "0 0 6px",
            color: "var(--foreground)",
            letterSpacing: -0.5,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Calendar size={26} style={{ color: "var(--primary)" }} />
          Календарь публикаций
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0 }}>
          Перетащите пост или рилс на день — он встанет в расписание. Чтобы снять с
          расписания — перетащите обратно в «Не запланировано» снизу.
        </p>
      </div>

      {!hasAnyContent && (
        <EmptyState
          icon={<Calendar size={28} />}
          title="Пока нечего планировать"
          description="Сгенерируйте посты или рилсы в Контент-заводе, и они появятся здесь готовыми к планированию."
        />
      )}

      {hasAnyContent && (
        <>
          {/* Month switcher */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={prevMonth}
              aria-label="Предыдущий месяц"
              style={navBtnStyle()}
            >
              <ChevronLeft size={16} />
            </button>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--foreground)",
                minWidth: 200,
                textAlign: "center",
              }}
            >
              {RU_MONTHS[month]} {year}
            </div>
            <button
              onClick={nextMonth}
              aria-label="Следующий месяц"
              style={navBtnStyle()}
            >
              <ChevronRight size={16} />
            </button>
            <button onClick={goToday} style={{ ...navBtnStyle(), padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
              Сегодня
            </button>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--muted-foreground)" }}>
              <Legend color="#f59e0b" label="Пост" />
              <Legend color="#ec4899" label="Рилс" />
            </div>
          </div>

          {/* Weekday header */}
          <div
            className="ds-keep-cols"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
              marginBottom: 6,
            }}
          >
            {RU_WEEKDAYS.map((d, i) => (
              <div
                key={d}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: i >= 5 ? "#ef4444" : "var(--muted-foreground)",
                  letterSpacing: "0.08em",
                  textAlign: "center",
                  padding: "8px 0",
                  textTransform: "uppercase",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div
            className="ds-keep-cols"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
              marginBottom: 24,
            }}
          >
            {grid.map(d => {
              const inMonth = d.getMonth() === month;
              const isToday = isSameDay(d, today);
              const k = dateKey(d);
              const items = scheduled.get(k) ?? [];
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isDragOver = dragOverKey === k;
              return (
                <div
                  key={k}
                  onDragOver={e => handleDragOver(e, k)}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={e => handleDropOnDate(e, d)}
                  onClick={() => items.length > 0 && setOpenDate(k)}
                  style={{
                    minHeight: 96,
                    padding: "8px 8px 6px",
                    borderRadius: 10,
                    border: `1.5px solid ${isToday ? "var(--primary)" : "var(--border)"}`,
                    background: isDragOver
                      ? "color-mix(in oklch, var(--primary) 10%, transparent)"
                      : inMonth
                      ? "var(--card)"
                      : "transparent",
                    opacity: inMonth ? 1 : 0.45,
                    cursor: items.length > 0 ? "pointer" : "default",
                    transition: "background 0.12s, border-color 0.12s",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isToday ? 800 : 600,
                        color: isToday
                          ? "var(--primary)"
                          : isWeekend
                          ? "#ef4444"
                          : "var(--foreground)",
                      }}
                    >
                      {d.getDate()}
                    </span>
                    {items.length > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--muted-foreground)",
                          background: "var(--muted)",
                          borderRadius: 6,
                          padding: "1px 6px",
                        }}
                      >
                        {items.length}
                      </span>
                    )}
                  </div>
                  {items.slice(0, 3).map(it => (
                    <DayChip key={it.item.id} item={it} compact />
                  ))}
                  {items.length > 3 && (
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
                      +{items.length - 3} ещё
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bank: unscheduled items */}
          <div
            onDragOver={e => handleDragOver(e, "__bank__")}
            onDragLeave={() => setDragOverKey(null)}
            onDrop={handleDropOnBank}
            style={{
              background:
                dragOverKey === "__bank__"
                  ? "color-mix(in oklch, var(--muted) 60%, transparent)"
                  : "var(--card)",
              border: `1px dashed var(--border)`,
              borderRadius: 14,
              padding: 16,
              transition: "background 0.12s",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <Inbox size={16} style={{ color: "var(--muted-foreground)" }} />
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--foreground)",
                  letterSpacing: "0.02em",
                }}
              >
                Не запланировано
              </h3>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--muted-foreground)",
                  background: "var(--muted)",
                  borderRadius: 8,
                  padding: "2px 8px",
                }}
              >
                {unscheduled.length}
              </span>
            </div>
            {unscheduled.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "12px 0" }}>
                Всё что есть — уже на расписании. Сгенерируйте новые посты в контент-заводе.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 8,
                }}
              >
                {unscheduled.map(it => (
                  <BankCard
                    key={it.item.id}
                    item={it}
                    onDragStart={e => handleDragStart(e, it)}
                    onSchedule={() => setScheduleTarget(it)}
                    onOpen={() => {
                      if (it.kind === "post") onGoToPost?.(it.item.id);
                      else onGoToReel?.(it.item.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Day-detail modal */}
      {openDate && (
        <DayDetailModal
          dateKey={openDate}
          items={scheduled.get(openDate) ?? []}
          onClose={() => setOpenDate(null)}
          onUnschedule={it => {
            if (it.kind === "post") {
              const n = { ...it.item };
              delete n.scheduledFor;
              onUpdatePost(n);
            } else {
              const n = { ...it.item };
              delete n.scheduledFor;
              onUpdateReel(n);
            }
          }}
          onGoTo={it => {
            if (it.kind === "post") onGoToPost?.(it.item.id);
            else onGoToReel?.(it.item.id);
            setOpenDate(null);
          }}
        />
      )}

      {/* Mobile fallback: date picker modal */}
      {scheduleTarget && (
        <SchedulePickerModal
          item={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onPick={iso => handleScheduleViaInput(scheduleTarget, iso)}
        />
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{ width: 10, height: 10, borderRadius: "50%", background: color }}
      />
      {label}
    </span>
  );
}

function navBtnStyle(): React.CSSProperties {
  return {
    background: "var(--card)",
    border: `1px solid var(--border)`,
    borderRadius: 10,
    padding: "8px 10px",
    color: "var(--foreground)",
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function DayChip({ item, compact }: { item: SchedulableItem; compact?: boolean }) {
  const isReel = item.kind === "reel";
  const accent = isReel ? "#ec4899" : "#f59e0b";
  const title = isReel ? (item.item as GeneratedReel).title : (item.item as GeneratedPost).hook;
  return (
    <div
      style={{
        background: `${accent}1c`,
        border: `1px solid ${accent}44`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: compact ? "3px 6px" : "6px 9px",
        fontSize: compact ? 11 : 12,
        color: "var(--foreground)",
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {isReel ? (
        <Film size={10} style={{ color: accent, flexShrink: 0 }} />
      ) : (
        <FileText size={10} style={{ color: accent, flexShrink: 0 }} />
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
    </div>
  );
}

function BankCard({
  item,
  onDragStart,
  onSchedule,
  onOpen,
}: {
  item: SchedulableItem;
  onDragStart: (e: React.DragEvent) => void;
  onSchedule: () => void;
  onOpen: () => void;
}) {
  const isReel = item.kind === "reel";
  const accent = isReel ? "#ec4899" : "#f59e0b";
  const title = isReel ? (item.item as GeneratedReel).title : (item.item as GeneratedPost).hook;
  const subtitle = isReel
    ? `Рилс · ${(item.item as GeneratedReel).durationSec}с`
    : `Пост · ${(item.item as GeneratedPost).platform || ""}`;
  const imageUrl = !isReel ? (item.item as GeneratedPost).imageUrl : undefined;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: "var(--background)",
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        padding: 10,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: imageUrl ? "transparent" : `${accent}22`,
          backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          flexShrink: 0,
        }}
      >
        {!imageUrl && (isReel ? <Film size={16} /> : <ImageIcon size={16} />)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--foreground)",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        <div
          style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}
        >
          {subtitle}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button
            onClick={onSchedule}
            style={{
              background: "transparent",
              border: `1px solid var(--border)`,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--foreground-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            На дату…
          </button>
          <button
            onClick={onOpen}
            style={{
              background: "transparent",
              border: "none",
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--primary)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Открыть
          </button>
        </div>
      </div>
    </div>
  );
}

function DayDetailModal({
  dateKey: k,
  items,
  onClose,
  onUnschedule,
  onGoTo,
}: {
  dateKey: string;
  items: SchedulableItem[];
  onClose: () => void;
  onUnschedule: (it: SchedulableItem) => void;
  onGoTo: (it: SchedulableItem) => void;
}) {
  const d = new Date(k + "T00:00:00");
  const dateStr = d.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: `1px solid var(--border)`,
          borderRadius: 16,
          padding: 22,
          maxWidth: 540,
          width: "100%",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--foreground)", textTransform: "capitalize" }}>
            {dateStr}
          </h3>
          <button onClick={onClose} aria-label="Закрыть" style={navBtnStyle()}>
            <X size={16} />
          </button>
        </div>
        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "20px 0" }}>
            На этот день ничего не запланировано
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map(it => {
              const isReel = it.kind === "reel";
              const accent = isReel ? "#ec4899" : "#f59e0b";
              const title = isReel ? (it.item as GeneratedReel).title : (it.item as GeneratedPost).hook;
              return (
                <div
                  key={it.item.id}
                  style={{
                    background: "var(--background)",
                    border: `1px solid var(--border)`,
                    borderLeft: `3px solid ${accent}`,
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {isReel ? <Film size={13} style={{ color: accent }} /> : <FileText size={13} style={{ color: accent }} />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {isReel ? "Рилс" : "Пост"}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.4, marginBottom: 8 }}>
                    {title}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => onGoTo(it)}
                      style={{
                        background: "var(--primary)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Открыть
                    </button>
                    <button
                      onClick={() => onUnschedule(it)}
                      style={{
                        background: "transparent",
                        color: "var(--foreground-secondary)",
                        border: `1px solid var(--border)`,
                        borderRadius: 8,
                        padding: "7px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Снять с расписания
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SchedulePickerModal({
  item,
  onClose,
  onPick,
}: {
  item: SchedulableItem;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const isReel = item.kind === "reel";
  const title = isReel ? (item.item as GeneratedReel).title : (item.item as GeneratedPost).hook;
  const [picked, setPicked] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: `1px solid var(--border)`,
          borderRadius: 16,
          padding: 22,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>
          Запланировать на дату
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted-foreground)",
            lineHeight: 1.5,
            marginBottom: 18,
          }}
        >
          {title}
        </p>
        <input
          type="date"
          value={picked}
          onChange={e => setPicked(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid var(--border)`,
            background: "var(--background)",
            color: "var(--foreground)",
            fontSize: 15,
            fontFamily: "inherit",
            marginBottom: 18,
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => onPick(picked)}
            style={{
              flex: 1,
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "12px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Запланировать
          </button>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--foreground)",
              border: `1px solid var(--border)`,
              borderRadius: 10,
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
