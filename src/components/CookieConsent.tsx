"use client";

/**
 * Куки-баннер по инструкции по персональным данным: Яндекс.Метрика грузится
 * глобально в layout, значит уведомление обязано показываться при первом
 * входе на ЛЮБУЮ страницу — включая публичные КП (/kp-share), куда клиент
 * приходит по ссылке без всякой регистрации.
 *
 * Модель из инструкции: всплывающий блок с кнопкой «Согласен», текст
 * «Сайт использует файлы cookie и сервис Яндекс.Метрика. Продолжая работу
 * с сайтом, вы соглашаетесь…», где «соглашаетесь» — ссылка на текст согласия
 * (/legal/consent-metrika), а политика cookie — отдельной ссылкой
 * (/legal/cookie). Выбор запоминается в localStorage: это не персональные
 * данные, серверу знать о нём не нужно.
 */
import { useEffect, useState } from "react";

const LS_KEY = "mr_cookie_ok";

export function CookieConsent() {
  // null до маунта — чтобы SSR и первый клиентский рендер совпали и не было
  // гидрационного мигания баннера у тех, кто давно согласился.
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(LS_KEY) !== "1");
    } catch {
      // Приватный режим без localStorage: показываем всегда — это хуже для
      // UX, но лучше, чем молча не уведомить.
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    try { localStorage.setItem(LS_KEY, "1"); } catch { /* приватный режим */ }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Использование файлов cookie"
      style={{
        position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 1000,
        maxWidth: 720, margin: "0 auto",
        display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap",
        padding: "14px 18px", borderRadius: 12,
        background: "var(--card, #fff)", color: "var(--foreground, #111)",
        border: "1px solid var(--border, #ddd)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
        fontSize: 13, lineHeight: 1.5,
      }}
    >
      <span style={{ flex: 1, minWidth: 240 }}>
        Сайт использует файлы cookie и сервис Яндекс.Метрика. Продолжая работу с сайтом, вы{" "}
        <a href="/legal/consent-metrika" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #2563eb)", textDecoration: "underline" }}>
          соглашаетесь
        </a>{" "}
        на обработку этих данных в соответствии с{" "}
        <a href="/legal/cookie" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #2563eb)", textDecoration: "underline" }}>
          Политикой обработки файлов cookie
        </a>.
      </span>
      {/*
        Кнопка красится в акцент СТРАНИЦЫ, а не в синий примари платформы.
        Лендинги (/check, /geo) задают свой --mrc-flare-ink терракотой, и
        синяя кнопка на них читалась как чужой элемент. Где переменной нет
        (кабинет), fallback возвращает обычный примари — вид не меняется.
      */}
      <button
        onClick={accept}
        className="ds-btn ds-btn-primary"
        style={{
          height: 38, padding: "0 22px", fontSize: 13.5, fontWeight: 700,
          borderRadius: 10, border: "none", cursor: "pointer",
          background: "var(--mrc-flare-ink, var(--primary, #2563eb))",
          color: "var(--primary-foreground, #fff)",
          flexShrink: 0,
        }}
      >
        Согласен
      </button>
    </div>
  );
}
