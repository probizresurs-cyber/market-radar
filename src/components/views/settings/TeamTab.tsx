"use client";

import React, { useEffect, useState, useCallback } from "react";
import { UserPlus, Trash2, X, AlertCircle, CheckCircle2, Copy, Mail, Shield, Eye } from "lucide-react";

interface Member {
  workspaceId: string;
  memberUserId: string;
  role: "editor" | "viewer";
  invitedBy: string | null;
  joinedAt: string;
  memberEmail?: string;
  memberName?: string | null;
}

interface PendingInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: "editor" | "viewer";
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Управление командой workspace — список членов и pending invites,
 * форма приглашения по email.
 *
 * Видна только владельцу собственной workspace. В чужих workspace'ах
 * этот таб не показывается (упасть может только если editor/viewer
 * откроет SettingsView; данные просто будут пустые, и API вернёт пустые
 * списки потому что у них своя workspace = свой userId).
 */
export function TeamTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string; url?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/members");
      const json = await res.json() as { ok: boolean; error?: string; members?: Member[]; pendingInvites?: PendingInvite[] };
      if (!json.ok) throw new Error(json.error || "Не удалось загрузить");
      setMembers(json.members ?? []);
      setPending(json.pendingInvites ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/workspace/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json() as { ok: boolean; error?: string; emailSent?: boolean; emailError?: string; invite?: { acceptUrl?: string } };
      if (!json.ok) throw new Error(json.error || "Не удалось пригласить");

      setInviteEmail("");
      if (json.emailSent) {
        setInviteResult({ ok: true, msg: "Приглашение отправлено по email" });
      } else {
        setInviteResult({
          ok: true,
          msg: json.emailError
            ? `Не получилось отправить письмо (${json.emailError}). Скопируйте ссылку и отправьте сами:`
            : "Приглашение создано. Скопируйте ссылку и отправьте получателю:",
          url: json.invite?.acceptUrl,
        });
      }
      load();
    } catch (err) {
      setInviteResult({ ok: false, msg: err instanceof Error ? err.message : "Ошибка" });
    } finally {
      setInviting(false);
    }
  };

  const remove = async (memberId: string) => {
    if (!confirm("Убрать участника из команды? Он потеряет доступ к дашборду.")) return;
    try {
      const res = await fetch(`/api/workspace/members?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const updateRole = async (memberId: string, role: "editor" | "viewer") => {
    try {
      const res = await fetch("/api/workspace/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const revokeInvite = async (code: string) => {
    if (!confirm("Отозвать приглашение?")) return;
    try {
      const res = await fetch(`/api/workspace/invite?code=${encodeURIComponent(code)}`, { method: "DELETE" });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Описание */}
      <div style={{ background: "var(--card)", padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 6 }}>
          Команда рабочего пространства
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
          Пригласите коллег или клиентов видеть ваш дашборд. <b>Редактор</b> может запускать
          анализы и редактировать данные. <b>Наблюдатель</b> видит всё только для чтения.
          Приглашение отправляется на email и действует 7 дней.
        </div>
      </div>

      {/* Форма приглашения */}
      <div style={{ background: "var(--card)", padding: 18, borderRadius: 10, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <UserPlus size={14} /> Пригласить нового участника
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            disabled={inviting}
            style={{
              flex: "1 1 220px", minWidth: 200,
              padding: "9px 12px", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--background)",
              color: "var(--foreground)", fontSize: 13, fontFamily: "inherit",
            }}
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as "editor" | "viewer")}
            disabled={inviting}
            style={{
              padding: "9px 12px", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--background)",
              color: "var(--foreground)", fontSize: 13, fontFamily: "inherit",
            }}
          >
            <option value="viewer">Наблюдатель</option>
            <option value="editor">Редактор</option>
          </select>
          <button
            onClick={invite}
            disabled={inviting || !inviteEmail.trim()}
            style={{
              padding: "9px 18px", borderRadius: 8,
              border: "none", background: "var(--primary)", color: "#fff",
              fontWeight: 700, fontSize: 13, cursor: inviting ? "default" : "pointer",
              opacity: inviting || !inviteEmail.trim() ? 0.6 : 1, fontFamily: "inherit",
            }}
          >
            {inviting ? "Отправляем…" : "Пригласить"}
          </button>
        </div>

        {inviteResult && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 8,
            background: inviteResult.ok ? "color-mix(in oklch, var(--success) 10%, transparent)" : "color-mix(in oklch, var(--destructive) 10%, transparent)",
            color: inviteResult.ok ? "var(--success)" : "var(--destructive)",
            fontSize: 12,
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            {inviteResult.ok ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
            <div style={{ flex: 1 }}>
              <div>{inviteResult.msg}</div>
              {inviteResult.url && (
                <div style={{
                  marginTop: 8, padding: 8, borderRadius: 6,
                  background: "var(--background)", color: "var(--foreground)",
                  fontFamily: "ui-monospace,monospace", fontSize: 11,
                  display: "flex", alignItems: "center", gap: 8, wordBreak: "break-all",
                }}>
                  <span style={{ flex: 1 }}>{inviteResult.url}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteResult.url ?? "")}
                    title="Скопировать"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)" }}
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Список членов */}
      {loading ? (
        <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Загрузка…</div>
      ) : error ? (
        <div style={{ color: "var(--destructive)", fontSize: 13 }}>{error}</div>
      ) : (
        <>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 }}>
              Участники команды ({members.length})
            </div>
            {members.length === 0 ? (
              <div style={{ padding: 16, color: "var(--muted-foreground)", fontSize: 13, background: "var(--card)", borderRadius: 10, border: "1px dashed var(--border)" }}>
                Никого ещё нет — пригласите коллег по email выше
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {members.map(m => (
                  <div key={m.memberUserId} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", background: "var(--card)",
                    borderRadius: 10, border: "1px solid var(--border)",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                        {m.memberName || m.memberEmail}
                      </div>
                      {m.memberName && (
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{m.memberEmail}</div>
                      )}
                    </div>
                    <select
                      value={m.role}
                      onChange={e => updateRole(m.memberUserId, e.target.value as "editor" | "viewer")}
                      style={{
                        padding: "5px 8px", borderRadius: 6,
                        border: "1px solid var(--border)", background: "var(--background)",
                        color: "var(--foreground)", fontSize: 12, fontFamily: "inherit",
                      }}
                    >
                      <option value="viewer">Наблюдатель</option>
                      <option value="editor">Редактор</option>
                    </select>
                    <button
                      onClick={() => remove(m.memberUserId)}
                      title="Убрать из команды"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--destructive)", padding: 6, borderRadius: 6,
                        display: "flex", alignItems: "center",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Mail size={13} /> Ожидают приёма ({pending.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pending.map(inv => {
                  const expires = new Date(inv.expiresAt);
                  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000));
                  return (
                    <div key={inv.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", background: "var(--card)",
                      borderRadius: 10, border: "1px dashed var(--border)",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{inv.email}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          {inv.role === "editor" ? <><Shield size={9} style={{ display: "inline", verticalAlign: "middle" }} /> Редактор</> : <><Eye size={9} style={{ display: "inline", verticalAlign: "middle" }} /> Наблюдатель</>}
                          {" · "}
                          {daysLeft > 0 ? `действует ещё ${daysLeft} дн.` : "истекает сегодня"}
                        </div>
                      </div>
                      <button
                        onClick={() => revokeInvite(inv.id)}
                        title="Отозвать приглашение"
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--muted-foreground)", padding: 6, borderRadius: 6,
                          display: "flex", alignItems: "center",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
