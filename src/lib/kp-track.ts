/**
 * Лёгкий клиентский трекинг вовлечённости на публичных страницах интерактивного
 * анализа (/kp, /kp-sozdavaya, /share/[id]) — просмотр, до какого раздела
 * долистали, клики по ключевым кнопкам. Fire-and-forget: не блокирует UI,
 * не показывает ошибок пользователю. См. /api/kp-track и /admin/kp-analytics.
 */

const SESSION_KEY = "mr_kp_session";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

/** path/shareId для текущего location — /share/<id> группируется по path="/share", id отдельно. */
export function currentKpTrackingTarget(): { path: string; shareId?: string } {
  if (typeof window === "undefined") return { path: "/kp" };
  const p = window.location.pathname;
  const m = p.match(/^\/share\/(.+)$/);
  return m ? { path: "/share", shareId: m[1] } : { path: p };
}

export function trackKpEvent(eventType: "view" | "section" | "click", label?: string) {
  if (typeof window === "undefined") return;
  const sessionId = getSessionId();
  if (!sessionId) return;
  const { path, shareId } = currentKpTrackingTarget();
  try {
    fetch("/api/kp-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, share_id: shareId, session_id: sessionId, event_type: eventType, label }),
      keepalive: true,
    }).catch(() => { /* тихо игнорируем — трекинг не критичен */ });
  } catch { /* ignore */ }
}
