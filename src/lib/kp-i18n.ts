// Словарь интерфейса менеджерских страниц /kp-ru и /kp-de.
// Контент самих КП приходит на нужном языке от AI — тут только UI-подписи.

export type KpLocale = "ru" | "de";

export interface KpStrings {
  title: string; subtitle: string;
  passwordPrompt: string; passwordPlaceholder: string; enter: string; wrongPassword: string;
  tabCreate: string; tabHistory: string; tabReview: string;
  createHint: string; urlsPlaceholder: string; generate: string; generating: string; queued: string;
  historyEmpty: string; refresh: string;
  statusQueued: string; statusRunning: string; statusDone: string; statusError: string;
  open: string; shareLabel: string; passwordLabel: string; copy: string; copied: string;
  delete: string; deleting: string; deleteConfirm: string;
  reviewEmpty: string;
  reviewClientEmail: string; reviewNoEmail: string; reviewCompare: string;
  reviewApprove: string; reviewReject: string; reviewApproving: string;
  reviewStatusRunning: string; reviewStatusPending: string; reviewStatusApproved: string;
  reviewStatusSent: string; reviewStatusRejected: string; reviewStatusError: string;
  reviewEmailSent: string; reviewEmailFailed: string;
}

export const KP_I18N: Record<KpLocale, KpStrings> = {
  ru: {
    title: "Генератор КП — Россия",
    subtitle: "Вставьте ссылку на сайт — соберём полное коммерческое предложение по реальному анализу, без предварительной работы.",
    passwordPrompt: "Введите пароль доступа",
    passwordPlaceholder: "Пароль",
    enter: "Войти",
    wrongPassword: "Неверный пароль",
    tabCreate: "Создать КП",
    tabHistory: "История",
    tabReview: "Ревью пересборок",
    createHint: "Одна ссылка на строку. Можно вставить несколько — они встанут в очередь и соберутся по очереди.",
    urlsPlaceholder: "https://site1.ru\nhttps://site2.ru",
    generate: "Сгенерировать",
    generating: "Ставим в очередь…",
    queued: "Поставлено в очередь",
    historyEmpty: "Пока нет ни одного КП. Создайте первое во вкладке «Создать КП».",
    refresh: "Обновить",
    statusQueued: "В очереди",
    statusRunning: "Генерируется…",
    statusDone: "Готово",
    statusError: "Ошибка",
    open: "Открыть КП",
    shareLabel: "Ссылка для клиента",
    passwordLabel: "Пароль",
    copy: "Копировать",
    copied: "Скопировано",
    delete: "Удалить",
    deleting: "Удаляем…",
    deleteConfirm: "Удалить КП",
    reviewEmpty: "Здесь появятся пересобранные сайты, ожидающие вашего одобрения перед отправкой клиенту.",
    reviewClientEmail: "Email клиента",
    reviewNoEmail: "Email не указан",
    reviewCompare: "Сравнить версии",
    reviewApprove: "Одобрить и отправить",
    reviewReject: "Отклонить",
    reviewApproving: "Отправляем…",
    reviewStatusRunning: "Собираем…",
    reviewStatusPending: "Ждёт вашего решения",
    reviewStatusApproved: "Одобрено — письмо не ушло",
    reviewStatusSent: "Отправлено клиенту",
    reviewStatusRejected: "Отклонено",
    reviewStatusError: "Ошибка пересборки",
    reviewEmailSent: "Письмо отправлено клиенту",
    reviewEmailFailed: "Письмо не ушло — отправьте ссылку клиенту вручную",
  },
  de: {
    title: "KP-Generator — Deutschland",
    subtitle: "Website-Link einfügen — wir erstellen ein vollständiges Angebot auf Basis einer echten Analyse, ohne Vorarbeit.",
    passwordPrompt: "Zugangspasswort eingeben",
    passwordPlaceholder: "Passwort",
    enter: "Anmelden",
    wrongPassword: "Falsches Passwort",
    tabCreate: "Angebot erstellen",
    tabHistory: "Verlauf",
    tabReview: "Umbau-Freigaben",
    createHint: "Ein Link pro Zeile. Mehrere möglich — sie werden nacheinander in der Warteschlange verarbeitet.",
    urlsPlaceholder: "https://site1.de\nhttps://site2.de",
    generate: "Generieren",
    generating: "In Warteschlange…",
    queued: "In Warteschlange gestellt",
    historyEmpty: "Noch keine Angebote. Erstellen Sie das erste im Tab „Angebot erstellen“.",
    refresh: "Aktualisieren",
    statusQueued: "In Warteschlange",
    statusRunning: "Wird generiert…",
    statusDone: "Fertig",
    statusError: "Fehler",
    open: "Angebot öffnen",
    shareLabel: "Link für den Kunden",
    passwordLabel: "Passwort",
    copy: "Kopieren",
    copied: "Kopiert",
    delete: "Löschen",
    deleting: "Wird gelöscht…",
    deleteConfirm: "Angebot löschen",
    reviewEmpty: "Hier erscheinen umgebaute Websites, die auf Ihre Freigabe vor dem Versand an den Kunden warten.",
    reviewClientEmail: "Kunden-E-Mail",
    reviewNoEmail: "Keine E-Mail angegeben",
    reviewCompare: "Versionen vergleichen",
    reviewApprove: "Freigeben & senden",
    reviewReject: "Ablehnen",
    reviewApproving: "Wird gesendet…",
    reviewStatusRunning: "Wird zusammengestellt…",
    reviewStatusPending: "Wartet auf Ihre Entscheidung",
    reviewStatusApproved: "Freigegeben — E-Mail nicht gesendet",
    reviewStatusSent: "An Kunden gesendet",
    reviewStatusRejected: "Abgelehnt",
    reviewStatusError: "Fehler beim Umbau",
    reviewEmailSent: "E-Mail an Kunden gesendet",
    reviewEmailFailed: "E-Mail nicht gesendet — Link bitte manuell an den Kunden senden",
  },
};
