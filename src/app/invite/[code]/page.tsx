"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

/**
 * Страница приёма приглашения в workspace.
 * URL: /invite/[code]  (code приходит в письме)
 *
 * Сценарии:
 *   1. Юзер не залогинен → редиректим на /login с ?next=/invite/[code]
 *   2. Залогинен, но email не совпадает с инвайтом → показываем сообщение
 *      «Войдите под аккаунтом X»
 *   3. Залогинен под правильным email → одной кнопкой принимает
 */

interface InviteInfo {
  id: string;
  workspaceId: string;
  email: string;
  role: "editor" | "viewer";
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  ownerEmail?: string;
  ownerName?: string | null;
  workspaceName?: string | null;
}

export default function AcceptInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // Загружаем инфу о приглашении + о текущей сессии параллельно
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [inviteRes, meRes] = await Promise.all([
          fetch(`/api/workspace/accept?code=${encodeURIComponent(code)}`),
          fetch(`/api/auth/me`, { credentials: "include" }),
        ]);
        const inviteJson = await inviteRes.json();
        const meJson = await meRes.json().catch(() => null);

        if (cancelled) return;

        if (!inviteJson.ok) {
          setError(inviteJson.error || "Не удалось загрузить приглашение");
        } else {
          setInfo(inviteJson.invite);
        }
        if (meJson?.user?.email) setSessionEmail(meJson.user.email);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка сети");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Не удалось принять приглашение");
      setAccepted(true);
      // Редиректим на главный экран — там новая workspace появится в свитчере
      setTimeout(() => router.push("/"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAccepting(false);
    }
  };

  const wrap = (children: React.ReactNode) => (
    <div style={{
      minHeight: "100vh", background: "var(--background, #0f172a)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        maxWidth: 480, width: "100%", background: "var(--card, #1e293b)",
        borderRadius: 16, padding: "36px 32px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        color: "var(--foreground, #f1f5f9)",
      }}>
        {children}
      </div>
    </div>
  );

  if (loading) return wrap(<div style={{ textAlign: "center", color: "var(--muted-foreground)" }}>Загружаем приглашение...</div>);

  if (error || !info) {
    return wrap(
      <>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Не удалось загрузить приглашение</div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 24 }}>
          {error || "Приглашение не найдено или истёк срок"}
        </div>
        <button onClick={() => router.push("/")}
          style={{ padding: "10px 20px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          На главную
        </button>
      </>
    );
  }

  if (accepted) {
    return wrap(
      <>
        <div style={{ fontSize: 36, marginBottom: 16, textAlign: "center" }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>Приглашение принято</div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", textAlign: "center" }}>
          Сейчас перенаправим на главный экран…
        </div>
      </>
    );
  }

  // Если приглашение уже использовано или отозвано
  if (info.acceptedAt) {
    return wrap(
      <>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Это приглашение уже использовано</div>
        <button onClick={() => router.push("/")}
          style={{ padding: "10px 20px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          На главную
        </button>
      </>
    );
  }
  if (info.revokedAt) {
    return wrap(<div style={{ fontSize: 20, fontWeight: 700 }}>Приглашение отозвано владельцем</div>);
  }

  // Не залогинен — отправляем на логин
  if (!sessionEmail) {
    return wrap(
      <>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Вас пригласили в команду</div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 4 }}>
          Workspace: <b style={{ color: "var(--foreground)" }}>{info.workspaceName}</b>
        </div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 20 }}>
          Роль: <b style={{ color: "var(--foreground)" }}>{info.role === "editor" ? "Редактор" : "Наблюдатель"}</b>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24, padding: 12, background: "var(--background)", borderRadius: 8 }}>
          Чтобы принять, войдите в аккаунт под адресом <b style={{ color: "var(--primary, #6366F1)" }}>{info.email}</b>
          {" "}или зарегистрируйтесь с этим email.
        </div>
        <button onClick={() => router.push(`/login?next=${encodeURIComponent(`/invite/${code}`)}`)}
          style={{ width: "100%", padding: "12px 20px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
          Войти / Зарегистрироваться
        </button>
      </>
    );
  }

  // Залогинен под другим email
  if (sessionEmail.toLowerCase() !== info.email.toLowerCase()) {
    return wrap(
      <>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Не тот аккаунт</div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 20 }}>
          Приглашение отправлено на <b style={{ color: "var(--foreground)" }}>{info.email}</b>,
          а вы вошли как <b style={{ color: "var(--foreground)" }}>{sessionEmail}</b>.
        </div>
        <button onClick={() => router.push(`/login?next=${encodeURIComponent(`/invite/${code}`)}`)}
          style={{ width: "100%", padding: "12px 20px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>
          Сменить аккаунт
        </button>
      </>
    );
  }

  // Готово — можно принимать
  return wrap(
    <>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Принять приглашение</div>
      <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 4 }}>
        Workspace: <b style={{ color: "var(--foreground)" }}>{info.workspaceName}</b>
      </div>
      <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 20 }}>
        Роль: <b style={{ color: "var(--foreground)" }}>{info.role === "editor" ? "Редактор" : "Наблюдатель"}</b>
        {" — "}
        {info.role === "editor"
          ? "вы сможете запускать анализы и редактировать дашборд"
          : "только просмотр без права изменений"}
      </div>
      <button onClick={accept} disabled={accepting}
        style={{
          width: "100%", padding: "12px 20px",
          background: accepting ? "var(--muted)" : "#6366F1",
          color: "#fff", border: "none", borderRadius: 10,
          cursor: accepting ? "default" : "pointer", fontWeight: 700, fontSize: 15,
        }}>
        {accepting ? "Принимаем…" : "Принять и перейти в дашборд"}
      </button>
    </>
  );
}
