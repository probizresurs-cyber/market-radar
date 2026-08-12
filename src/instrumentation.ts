/**
 * Страховка процесса от краш-лупа.
 *
 * Инцидент: обрыв клиента на отдаче mp3 бросал uncaughtException
 * («ReadableStream is already closed»), Node умирал, PM2 рестартовал его
 * каждую минуту — и ВЕСЬ сайт отвечал 502, потому что один человек открыл
 * аудиофайл. Корень вылечен (Readable.toWeb в медиа-роутах), но класс
 * проблемы шире: любой стрим/сокет, оборванный клиентом в неудачный момент,
 * не должен стоить доступности всей платформы.
 *
 * Осознанный компромисс: перехваченный uncaughtException оставляет процесс
 * жить с риском грязного состояния. Для контент-платформы регулярный 502 на
 * всех пользователей хуже этого риска. Ошибки логируются с полным стеком —
 * они остаются видимыми в pm2 logs, просто перестают быть фатальными.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("uncaughtException", (err) => {
    console.error("[instrumentation] uncaughtException (процесс сохранён):", err);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[instrumentation] unhandledRejection (процесс сохранён):", reason);
  });
}
