// Словарь статичного UI-текста KpProposal (заголовки секций, лейблы, хинты) —
// НЕ содержимое КП (это генерирует AI на нужном языке в PilotBundle), а
// обвес вокруг него: навигация, подписи тех-аудита, легенда достоверности и
// т.п. Раньше был захардкожен только на русском — на живом немецком КП это
// давало наполовину-русскую страницу. Используется только когда КП рендерится
// как pilotOffer (generatedBundle/pilotClient); обычный /kp (не pilot) всегда
// на русском и в словарь не завязан.

export type KpProposalLocale = "ru" | "de";

export interface KpProposalStrings {
  navOverview: string; navStrengths: string; navFindings: string; navTech: string;
  navCompetitors: string; navRivals: string; navAiVisibility: string; navGeo: string;
  navPositions: string; navOffer: string; navFormat: string; navForecast: string;
  navAstroOffer: string; navCta: string;
  themeLight: string; themeDark: string;
  brandSuffix: string;
  heroKicker: string; heroPotentialLabel: string; heroDiscussBtn: string; heroOfferBtnPrefix: string;
  stickyFixedPrice: string; stickyStartBtn: string;
  ringScoreLabel: string;
  profileByCategories: string;
  categoryVerdictLow: string; categoryVerdictMid: string; categoryVerdictHigh: string;
  whyImportant: string;
  whyAheadBy: (n: number) => string;
  whyBehindBy: (n: number) => string;
  whyAtAverage: string;
  whyCompetitorsAhead: (n: number) => string;
  whyBody: (criticalCount: number, opportunityCount: number) => string;
  whySeePlan: string;
  strengthsTitle: string; strengthsSubtitle: string;
  howToReadReport: string;
  weRelyOnThis: string;
  findingsTitle: string; findingsSubtitle: string;
  severityCritical: string; severityWarning: string;
  whatToDo: string; whatItGives: string; forecastSuffix: string;
  techTitle: string; techSubtitle: string;
  tabMobile: string; tabDesktop: string;
  perfLabel: string; perfHint: string;
  techSeoLabel: string; techSeoHint: string;
  accessibilityLabel: string; accessibilityHint: string;
  lcpHint: string; clsHint: string; tbtHint: string;
  competitorsTitle: string; competitorsSubtitle: string;
  youSuffix: string;
  trafficLabel: string; top10Label: string; pagesLabel: string; aiMentionsLabel: string;
  rivalsTitle: string; rivalsSubtitle: string;
  strongIn: string; weakSpot: string; whatWeTake: string;
  aiVisibilityTitleFull: string; aiVisibilitySubtitleFull: string;
  aiVisibilityTitleFallback: string; aiVisibilitySubtitleFallback: string;
  aiVisibilityRingLabel: string;
  aiPresenceLabel: string;
  aiPresenceStrong: string; aiPresenceModerate: string; aiPresenceWeak: string; aiPresenceMinimal: string;
  aiMentionsSuffix: string;
  aiZeroMentionsWarning: string;
  eeatExpertise: string; eeatAuthority: string; eeatTrust: string; eeatExperience: string;
  aiSampleAnswerLabel: string;
  geoTitle: string; geoSubtitle: string;
  geoAssistantRewardsTitle: string;
  geoLeversTitle: string;
  geoMethodTitle: string; geoMethodQuestionsLabel: string;
  geoForecastTitle: string;
  positionsTitleEngine: (engine: string) => string;
  positionsOutOfTop30: string; positionsCheckFailed: string; positionsDiagnosisLabel: string;
  savingsHeadlineFallback: string;
  marketerInStaff: string; marketerNote: string; ourTeamLabel: string; ourNoteFallback: string;
  offerStartTitle: string; offerStartSubtitle: string;
  offerIncludes: string; offerGets: string; offerWhyPrice: string;
  offerMonthlyLabel: string; offerTimelineLabel: string; offerStartBtn: string;
  formatTitle: string; formatSubtitle: string;
  articlesExampleLabel: string; articleCollapse: string; articleExpand: string;
  articleWhySeo: string;
  articleMechanicsLabel: string;
  month1Label: string;
  socialFactoryLabel: string; socialFactoryText: string;
  forecastTitle: string; forecastSubtitle: string;
  howWeCalculate: string; exampleCalc: string;
  month1Short: string; month3Short: string; month6Short: string;
  chartTitle: string; chartSubtitle: string; chartAriaLabel: string;
  chartDataTable: string; chartChannel: string; chartTotal: string;
  summaryTitle: string; requestsPerMonth: string;
  unitEconDealsFallback: string; unitEconCheckFallback: string; unitEconEntryFallback: string;
  unitEconCheckValueFallback: string;
  astroOfferTitle: string; astroOfferSubtitle: string;
  astroDone: string; astroDoneBody: (email: string) => string;
  astroDoneReady: string; astroDoneReadyBody: (email: string) => string; astroOpenSiteBtn: string;
  astroInProgress: string; astroInProgressBody: (email: string) => string;
  astroPitch: string;
  astroEmailPlaceholder: string; astroEmailInvalid: string;
  astroSubmitting: string; astroSubmitBtn: string;
  astroRequestError: string; astroTooManyRequests: string;
  astroPhonePlaceholder: string;
  tgConnectPrompt: string; tgConnectBtn: string;
  finalCtaAstroTitle: string; finalCtaAstroBody: string; finalCtaAstroBtn: string;
  finalCtaGenericTitle: string; finalCtaGenericBody: string; leaveRequestBtn: string;
  evidenceFact: string; evidenceEstimate: string; evidenceForecast: string;
  evidenceLegendPrefix: string;
  evidenceLegendFact: string; evidenceLegendEstimate: string; evidenceLegendForecast: string;
  footerAutoGenerated: string;
}

export const KP_PROPOSAL_I18N: Record<KpProposalLocale, KpProposalStrings> = {
  ru: {
    navOverview: "Обзор", navStrengths: "Сильные стороны", navFindings: "Находки", navTech: "Тех-аудит",
    navCompetitors: "Конкуренты", navRivals: "Лидеры ниши", navAiVisibility: "AI-видимость", navGeo: "GEO-видимость",
    navPositions: "Позиции", navOffer: "Предложение", navFormat: "Формат работ", navForecast: "Прогноз",
    navAstroOffer: "Новая версия сайта", navCta: "Заявка",
    themeLight: "Светлая тема", themeDark: "Тёмная тема",
    brandSuffix: "Анализ",
    heroKicker: "Интерактивный анализ сайта", heroPotentialLabel: "Потенциал после устранения находок",
    heroDiscussBtn: "Обсудить проект", heroOfferBtnPrefix: "Предложение — от",
    stickyFixedPrice: "фиксированная цена", stickyStartBtn: "Начать",
    ringScoreLabel: "общий балл / 100",
    profileByCategories: "Профиль по категориям",
    categoryVerdictLow: "Показатель значительно ниже нормы. Это напрямую тормозит привлечение клиентов из этого канала.",
    categoryVerdictMid: "Средний уровень: конкуренты с более сильным показателем забирают часть вашей аудитории.",
    categoryVerdictHigh: "Хороший результат, поддерживаем на текущем уровне.",
    whyImportant: "Почему это важно",
    whyAheadBy: (n) => `Вы опережаете средний уровень по нише на ${n} ${ruPluralPoints(n)}`,
    whyBehindBy: (n) => `Вы отстаёте от среднего уровня по нише на ${n} ${ruPluralPoints(n)}`,
    whyAtAverage: "Вы на уровне среднего по нише",
    whyCompetitorsAhead: (n) => ` — ${n} ${ruPlural(n, "конкурент опережает", "конкурента опережают", "конкурентов опережают")} вас по общему баллу`,
    whyBody: (crit, opp) => {
      let s = "Это напрямую влияет на то, сколько клиентов доходит до вас, а не до конкурентов.";
      if (crit > 0) s += ` Мы нашли ${crit} ${ruPlural(crit, "критичную проблему", "критичные проблемы", "критичных проблем")}`;
      if (crit > 0 && opp > 0) s += " и ";
      if (opp > 0) s += `${crit > 0 ? "" : "Нашли "}${opp} ${ruPlural(opp, "точку роста", "точки роста", "точек роста")}`;
      return s + " — ниже показываем план, с чего начать и что это даёт.";
    },
    whySeePlan: "Смотреть план работ",
    strengthsTitle: "Что уже работает", strengthsSubtitle: "Честный аудит начинается с сильных сторон — их нельзя сломать в ходе работ, на них мы опираемся",
    howToReadReport: "Как читать отчёт:",
    weRelyOnThis: "На это опираемся:",
    findingsTitle: "Находки — с доказательствами и эффектом", findingsSubtitle: "Каждая находка: что нашли → почему это важно → что делать → что это даст",
    severityCritical: "КРИТИЧНО", severityWarning: "ВНИМАНИЕ",
    whatToDo: "ЧТО ДЕЛАТЬ", whatItGives: "ЧТО ДАСТ", forecastSuffix: "прогноз",
    techTitle: "Технический аудит", techSubtitle: "Скорость и качество страниц по данным Google Lighthouse / Core Web Vitals",
    tabMobile: "Мобильные", tabDesktop: "Десктоп",
    perfLabel: "Производительность", perfHint: "Как быстро грузится сайт. Низкий балл — люди уходят, не дождавшись.",
    techSeoLabel: "Тех. SEO страницы", techSeoHint: "Технические основы: title, мета-теги, мобильность. Это не позиции — за реальную видимость отвечает SEO-балл по трафику.",
    accessibilityLabel: "Доступность", accessibilityHint: "Удобство и корректность вёрстки — сигнал качества для людей и роботов.",
    lcpHint: "Загрузка основного контента. Хорошо — до 2,5 с.",
    clsHint: "Сдвиги вёрстки при загрузке. Хорошо — меньше 0,1.",
    tbtHint: "Задержка отклика на клики. Хорошо — меньше 200 мс.",
    competitorsTitle: "Где вы среди конкурентов", competitorsSubtitle: "Общий балл вашего сайта против конкурентов из вашей ниши",
    youSuffix: "вы",
    trafficLabel: "Трафик из поиска / сут", top10Label: "Запросов в топ-10", pagesLabel: "Страниц в выдаче", aiMentionsLabel: "Упоминаний в ИИ-ответах",
    rivalsTitle: "Лидеры ниши — разобраны вручную", rivalsSubtitle: "Три сайта из топа выдачи по ключевым запросам. У каждого — что забираем себе",
    strongIn: "Сильны в", weakSpot: "Слабое место", whatWeTake: "Что забираем",
    aiVisibilityTitleFull: "AI-видимость", aiVisibilitySubtitleFull: "Насколько бренд заметен в ответах AI-ассистентов — ChatGPT, Claude, YandexGPT, Gemini",
    aiVisibilityTitleFallback: "AI-видимость", aiVisibilitySubtitleFallback: "Как нейросети воспринимают ваш бренд — по анализу присутствия в ответах AI-ассистентов",
    aiVisibilityRingLabel: "AI-видимость / 100",
    aiPresenceLabel: "Присутствие в ответах нейросетей",
    aiPresenceStrong: "Сильное — нейросети знают и рекомендуют бренд",
    aiPresenceModerate: "Умеренное — бренд иногда упоминается",
    aiPresenceWeak: "Слабое — нейросети почти не знают о бренде",
    aiPresenceMinimal: "Минимальное — бренда фактически нет в ответах нейросетей",
    aiMentionsSuffix: "упоминаний бренда в ответах нейросетей на момент анализа",
    aiZeroMentionsWarning: "Когда клиент спрашивает у нейросети «кто в вашей нише лучше», бренд не называют ни разу — весь этот трафик уходит к конкурентам, которых AI уже знает.",
    eeatExpertise: "Экспертность", eeatAuthority: "Авторитет", eeatTrust: "Доверие", eeatExperience: "Опыт",
    aiSampleAnswerLabel: "Что нейросеть отвечает о вас сейчас",
    geoTitle: "GEO: видимость в ответах нейросетей", geoSubtitle: "Отдельный, растущий канал — как попасть в ответы AI-ассистентов, когда клиент ищет решение",
    geoAssistantRewardsTitle: "Что вознаграждает каждый ассистент",
    geoLeversTitle: "Чем мы поднимаем цитируемость",
    geoMethodTitle: "Как честно замеряем результат", geoMethodQuestionsLabel: "Примеры контрольных вопросов",
    geoForecastTitle: "Прогноз по GEO-каналу",
    positionsTitleEngine: (engine) => `Позиции в поиске — живая проверка в ${engine}`,
    positionsOutOfTop30: "вне топ-30", positionsCheckFailed: "не удалось проверить", positionsDiagnosisLabel: "Диагноз:",
    savingsHeadlineFallback: "Столько же работы — в разы дешевле штатного маркетолога",
    marketerInStaff: "Маркетолог в штате", marketerNote: "+ налоги, отпуск, обучение, риск «не сработается»",
    ourTeamLabel: "MarketRadar — команда + AI", ourNoteFallback: "Отчёт с цифрами каждую неделю, гарантия возврата за месяц",
    offerStartTitle: "С чего предлагаем начать", offerStartSubtitle: "Разовый вход с фиксированной ценой + два месячных направления",
    offerIncludes: "Что входит", offerGets: "Что получите", offerWhyPrice: "Почему такая цена:",
    offerMonthlyLabel: "Дальше — помесячно", offerTimelineLabel: "Что происходит после старта", offerStartBtn: "Начать с переноса",
    formatTitle: "Как это будет выглядеть", formatSubtitle: "Формат SEO+GEO статей — иллюстрация, не готовые публикации",
    articlesExampleLabel: "Пример формата статей — нажмите, чтобы прочитать", articleCollapse: "Свернуть ↑", articleExpand: "Читать →",
    articleWhySeo: "Почему это работает на SEO и GEO",
    articleMechanicsLabel: "Почему такой формат в целом поднимает SEO и особенно GEO",
    month1Label: "Ориентир на первый месяц",
    socialFactoryLabel: "Контент-завод для соцсетей",
    socialFactoryText: "Разберём нишу и аудиторию, найдём форматы, которые сейчас заходят, и соберём контент-план со сценариями на неделю вперёд. Примеры готовых роликов покажем уже в процессе работы, после старта.",
    forecastTitle: "Прогноз: что даст каждый канал и когда", forecastSubtitle: "Расчётная модель с вилкой — ориентир для планирования, не гарантия",
    howWeCalculate: "Как считаем", exampleCalc: "Пример расчёта.",
    month1Short: "1-й месяц", month3Short: "3-й месяц", month6Short: "6-й месяц",
    chartTitle: "Дополнительные заявки в месяц — по каналам", chartSubtitle: "Середины вилок по каждому сценарию · наведите на месяц для разбивки",
    chartAriaLabel: "Прогноз дополнительных заявок в месяц по каналам, месяцы 1–6",
    chartDataTable: "Таблица данных графика", chartChannel: "Канал", chartTotal: "Итого",
    summaryTitle: "Сводный прогноз к 6-му месяцу · юнит-экономика", requestsPerMonth: "заявок в месяц",
    unitEconDealsFallback: "договоров в месяц (конверсия 15–25%)", unitEconCheckFallback: "средний чек проекта",
    unitEconCheckValueFallback: "150–500 тыс ₽",
    unitEconEntryFallback: "Разовый вход за перенос сайта на Astro: окупается с первого договора.",
    astroOfferTitle: "Хотите увидеть сайт быстрее и без потери дизайна?", astroOfferSubtitle: "Соберём рабочую копию на современном движке: тот же вид 1:1, устранены технические проблемы из находок выше",
    astroDone: "Готово — ссылка у вас на почте", astroDoneBody: (email) => `Мы собрали новую версию сайта и отправили ссылку на ${email}. Если письма нет — проверьте папку «Спам» или напишите нам.`,
    astroDoneReady: "Новая версия сайта готова", astroDoneReadyBody: (email) => `Откройте её по кнопке ниже. Копию ссылки мы также отправили на ${email}.`, astroOpenSiteBtn: "Открыть новый сайт",
    astroInProgress: "Собираем новую версию сайта", astroInProgressBody: (email) => `Обычно это занимает около 1 дня. Как только всё будет готово и проверено, пришлём ссылку на ${email}.`,
    astroPitch: "Дизайн останется точно таким же — переносим только «внутряк»: устраняем технические проблемы из находок выше и готовим сайт к SEO и GEO. Оставьте email — пришлём ссылку на готовую версию, как только менеджер её проверит.",
    astroEmailPlaceholder: "you@company.ru", astroEmailInvalid: "Укажите корректный email",
    astroSubmitting: "Отправляем…", astroSubmitBtn: "Да, интересно",
    astroRequestError: "Не получилось отправить запрос — попробуйте позже", astroTooManyRequests: "Слишком много запросов — попробуйте позже",
    astroPhonePlaceholder: "Телефон (необязательно)",
    tgConnectPrompt: "Не хотите пропустить уведомление? Подключите Telegram — пришлём готовую ссылку туда же.",
    tgConnectBtn: "Подключить Telegram",
    finalCtaAstroTitle: "Готовы посмотреть новую версию сайта?", finalCtaAstroBody: "Один шаг — оставьте email в блоке «Новая версия сайта» выше, и мы соберём рабочую копию с сохранённым дизайном.", finalCtaAstroBtn: "Собрать новую версию сайта",
    finalCtaGenericTitle: "Готовы вырасти в выдаче и лидах?", finalCtaGenericBody: "Разберём находки по вашему сайту, подберём пакет под задачи и покажем прогноз результата.", leaveRequestBtn: "Оставить заявку",
    evidenceFact: "ФАКТ", evidenceEstimate: "ОЦЕНКА", evidenceForecast: "ПРОГНОЗ",
    evidenceLegendPrefix: "Как читать отчёт:",
    evidenceLegendFact: "проверено вручную, есть доказательство", evidenceLegendEstimate: "экспертная оценка по косвенным данным", evidenceLegendForecast: "расчётная модель с вилкой — ориентир для планирования, не гарантия",
    footerAutoGenerated: "Анализ сгенерирован автоматически платформой MarketRadar · прогнозы — расчётная модель, помечены как ПРОГНОЗ",
  },
  de: {
    navOverview: "Übersicht", navStrengths: "Stärken", navFindings: "Erkenntnisse", navTech: "Technik-Audit",
    navCompetitors: "Wettbewerber", navRivals: "Marktführer", navAiVisibility: "KI-Sichtbarkeit", navGeo: "GEO-Sichtbarkeit",
    navPositions: "Positionen", navOffer: "Angebot", navFormat: "Arbeitsformat", navForecast: "Prognose",
    navAstroOffer: "Neue Website-Version", navCta: "Anfrage",
    themeLight: "Heller Modus", themeDark: "Dunkler Modus",
    brandSuffix: "Analyse",
    heroKicker: "Interaktive Website-Analyse", heroPotentialLabel: "Potenzial nach Behebung der Erkenntnisse",
    heroDiscussBtn: "Projekt besprechen", heroOfferBtnPrefix: "Angebot — ab",
    stickyFixedPrice: "Festpreis", stickyStartBtn: "Starten",
    ringScoreLabel: "Gesamtscore / 100",
    profileByCategories: "Profil nach Kategorien",
    categoryVerdictLow: "Der Wert liegt deutlich unter dem Standard. Das bremst direkt die Kundengewinnung über diesen Kanal.",
    categoryVerdictMid: "Mittleres Niveau: Wettbewerber mit stärkerem Wert gewinnen einen Teil Ihrer Zielgruppe.",
    categoryVerdictHigh: "Gutes Ergebnis — auf diesem Niveau halten.",
    whyImportant: "Warum das wichtig ist",
    whyAheadBy: (n) => `Sie liegen ${n} ${n === 1 ? "Punkt" : "Punkte"} über dem Branchendurchschnitt`,
    whyBehindBy: (n) => `Sie liegen ${n} ${n === 1 ? "Punkt" : "Punkte"} unter dem Branchendurchschnitt`,
    whyAtAverage: "Sie liegen auf dem Branchendurchschnitt",
    whyCompetitorsAhead: (n) => ` — ${n} Wettbewerber ${n === 1 ? "liegt" : "liegen"} im Gesamtscore vor Ihnen`,
    whyBody: (crit, opp) => {
      let s = "Das wirkt sich direkt darauf aus, wie viele Kunden zu Ihnen statt zu Wettbewerbern gelangen.";
      const parts: string[] = [];
      if (crit > 0) parts.push(`${crit} ${crit === 1 ? "kritisches Problem" : "kritische Probleme"}`);
      if (opp > 0) parts.push(`${opp} ${opp === 1 ? "Wachstumschance" : "Wachstumschancen"}`);
      if (parts.length) s += ` Wir haben ${parts.join(" und ")} gefunden`;
      return s + " — unten zeigen wir den Plan, womit zu beginnen ist und was das bringt.";
    },
    whySeePlan: "Arbeitsplan ansehen",
    strengthsTitle: "Was bereits funktioniert", strengthsSubtitle: "Ein ehrliches Audit beginnt mit den Stärken — sie dürfen im Projektverlauf nicht beschädigt werden, wir bauen darauf auf",
    howToReadReport: "So lesen Sie den Bericht:",
    weRelyOnThis: "Darauf bauen wir auf:",
    findingsTitle: "Erkenntnisse — mit Belegen und Wirkung", findingsSubtitle: "Jede Erkenntnis: was gefunden wurde → warum es wichtig ist → was zu tun ist → was es bringt",
    severityCritical: "KRITISCH", severityWarning: "ACHTUNG",
    whatToDo: "WAS ZU TUN IST", whatItGives: "WAS ES BRINGT", forecastSuffix: "Prognose",
    techTitle: "Technik-Audit", techSubtitle: "Geschwindigkeit und Qualität der Seiten nach Google-Lighthouse- / Core-Web-Vitals-Daten",
    tabMobile: "Mobil", tabDesktop: "Desktop",
    perfLabel: "Performance", perfHint: "Wie schnell die Website lädt. Bei niedrigem Wert springen Besucher ab, bevor die Seite fertig geladen ist.",
    techSeoLabel: "Technisches SEO", techSeoHint: "Technische Grundlagen: Title, Meta-Tags, Mobiltauglichkeit. Das sind keine Rankings — echte Sichtbarkeit misst der traffic-basierte SEO-Score.",
    accessibilityLabel: "Barrierefreiheit", accessibilityHint: "Bedienfreundlichkeit und korrektes Markup — ein Qualitätssignal für Menschen und Suchmaschinen.",
    lcpHint: "Ladezeit des Hauptinhalts. Gut — bis 2,5 s.",
    clsHint: "Layout-Verschiebungen beim Laden. Gut — weniger als 0,1.",
    tbtHint: "Reaktionsverzögerung bei Klicks. Gut — weniger als 200 ms.",
    competitorsTitle: "Ihre Position unter Wettbewerbern", competitorsSubtitle: "Gesamtscore Ihrer Website im Vergleich zu Wettbewerbern aus Ihrer Branche",
    youSuffix: "Sie",
    trafficLabel: "Suchtraffic / Tag", top10Label: "Keywords in Top 10", pagesLabel: "Seiten in der Ergebnisliste", aiMentionsLabel: "Erwähnungen in KI-Antworten",
    rivalsTitle: "Marktführer — manuell analysiert", rivalsSubtitle: "Drei Websites aus den Top-Suchergebnissen zu Ihren Schlüsselbegriffen. Zu jeder: was wir für Sie übernehmen",
    strongIn: "Stark in", weakSpot: "Schwachstelle", whatWeTake: "Was wir übernehmen",
    aiVisibilityTitleFull: "KI-Sichtbarkeit", aiVisibilitySubtitleFull: "Wie sichtbar die Marke in den Antworten von KI-Assistenten ist — ChatGPT, Claude, Gemini",
    aiVisibilityTitleFallback: "KI-Sichtbarkeit", aiVisibilitySubtitleFallback: "Wie KI-Systeme Ihre Marke wahrnehmen — basierend auf der Präsenz in KI-Antworten",
    aiVisibilityRingLabel: "KI-Sichtbarkeit / 100",
    aiPresenceLabel: "Präsenz in KI-Antworten",
    aiPresenceStrong: "Stark — KI-Systeme kennen und empfehlen die Marke",
    aiPresenceModerate: "Moderat — die Marke wird gelegentlich erwähnt",
    aiPresenceWeak: "Schwach — KI-Systeme kennen die Marke kaum",
    aiPresenceMinimal: "Minimal — die Marke taucht in KI-Antworten praktisch nicht auf",
    aiMentionsSuffix: "Markenerwähnungen in KI-Antworten zum Analysezeitpunkt",
    aiZeroMentionsWarning: "Wenn ein Kunde eine KI fragt, wer in Ihrer Branche führend ist, wird die Marke kein einziges Mal genannt — dieser Traffic geht an Wettbewerber, die die KI bereits kennt.",
    eeatExpertise: "Expertise", eeatAuthority: "Autorität", eeatTrust: "Vertrauen", eeatExperience: "Erfahrung",
    aiSampleAnswerLabel: "Was die KI aktuell über Sie antwortet",
    geoTitle: "GEO: Sichtbarkeit in KI-Antworten", geoSubtitle: "Ein separater, wachsender Kanal — wie man in die Antworten von KI-Assistenten gelangt, wenn ein Kunde nach einer Lösung sucht",
    geoAssistantRewardsTitle: "Was jeder Assistent belohnt",
    geoLeversTitle: "Womit wir die Zitierhäufigkeit steigern",
    geoMethodTitle: "So messen wir das Ergebnis ehrlich", geoMethodQuestionsLabel: "Beispiele für Testfragen",
    geoForecastTitle: "Prognose für den GEO-Kanal",
    positionsTitleEngine: (engine) => `Suchpositionen — Live-Prüfung bei ${engine}`,
    positionsOutOfTop30: "außerhalb Top 30", positionsCheckFailed: "Prüfung fehlgeschlagen", positionsDiagnosisLabel: "Diagnose:",
    savingsHeadlineFallback: "Gleiche Arbeit — ein Bruchteil der Kosten eines Inhouse-Marketers",
    marketerInStaff: "Inhouse-Marketer", marketerNote: "+ Steuern, Urlaub, Einarbeitung, Risiko einer Fehlbesetzung",
    ourTeamLabel: "MarketRadar — Team + KI", ourNoteFallback: "Wöchentlicher Bericht mit Zahlen, Geld-zurück-Garantie nach einem Monat",
    offerStartTitle: "Womit wir vorschlagen zu beginnen", offerStartSubtitle: "Einmaliger Einstieg zum Festpreis + zwei monatliche Leistungslinien",
    offerIncludes: "Was enthalten ist", offerGets: "Was Sie erhalten", offerWhyPrice: "Warum dieser Preis:",
    offerMonthlyLabel: "Danach — monatlich", offerTimelineLabel: "Was nach dem Start passiert", offerStartBtn: "Mit der Migration starten",
    formatTitle: "So wird es aussehen", formatSubtitle: "Format der SEO+GEO-Artikel — zur Veranschaulichung, keine fertigen Veröffentlichungen",
    articlesExampleLabel: "Beispiel für das Artikelformat — zum Lesen klicken", articleCollapse: "Einklappen ↑", articleExpand: "Lesen →",
    articleWhySeo: "Warum das für SEO und GEO funktioniert",
    articleMechanicsLabel: "Warum dieses Format insgesamt SEO und besonders GEO stärkt",
    month1Label: "Orientierung für den ersten Monat",
    socialFactoryLabel: "Content-Fabrik für Social Media",
    socialFactoryText: "Wir analysieren Ihre Branche und Zielgruppe, finden aktuell funktionierende Formate und erstellen einen Content-Plan mit Szenarien für die kommende Woche. Beispiele fertiger Clips zeigen wir bereits während der Arbeit nach dem Start.",
    forecastTitle: "Prognose: was jeder Kanal bringt und wann", forecastSubtitle: "Rechenmodell mit Spanne — Orientierung für die Planung, keine Garantie",
    howWeCalculate: "So rechnen wir", exampleCalc: "Rechenbeispiel.",
    month1Short: "1. Monat", month3Short: "3. Monat", month6Short: "6. Monat",
    chartTitle: "Zusätzliche Anfragen pro Monat — nach Kanälen", chartSubtitle: "Mittelwerte der Spannen je Szenario · Aufschlüsselung beim Überfahren eines Monats",
    chartAriaLabel: "Prognose zusätzlicher Anfragen pro Monat nach Kanälen, Monate 1–6",
    chartDataTable: "Datentabelle des Diagramms", chartChannel: "Kanal", chartTotal: "Gesamt",
    summaryTitle: "Gesamtprognose zum 6. Monat · Unit-Economics", requestsPerMonth: "Anfragen pro Monat",
    unitEconDealsFallback: "Verträge pro Monat (Konversionsrate 15–25 %)", unitEconCheckFallback: "durchschnittlicher Projektwert",
    unitEconCheckValueFallback: "1.500–5.000 €",
    unitEconEntryFallback: "Einmaliger Einstieg für die Migration auf Astro: amortisiert sich ab dem ersten Vertrag.",
    astroOfferTitle: "Möchten Sie die Website schneller sehen — ohne das Design zu verlieren?", astroOfferSubtitle: "Wir erstellen eine Arbeitskopie auf einer modernen Engine: gleiches Erscheinungsbild 1:1, technische Probleme aus den obigen Erkenntnissen behoben",
    astroDone: "Fertig — der Link ist in Ihrem Postfach", astroDoneBody: (email) => `Wir haben die neue Version der Website erstellt und den Link an ${email} gesendet. Falls keine E-Mail ankommt — prüfen Sie den Spam-Ordner oder schreiben Sie uns.`,
    astroDoneReady: "Die neue Version der Website ist fertig", astroDoneReadyBody: (email) => `Öffnen Sie sie über den Button unten. Eine Kopie des Links haben wir auch an ${email} gesendet.`, astroOpenSiteBtn: "Neue Website öffnen",
    astroInProgress: "Wir erstellen die neue Version der Website", astroInProgressBody: (email) => `Das dauert normalerweise etwa 1 Tag. Sobald alles fertig und geprüft ist, senden wir den Link an ${email}.`,
    astroPitch: "Das Design bleibt exakt gleich — wir übertragen nur die technische Basis: wir beheben die technischen Probleme aus den obigen Erkenntnissen und bereiten die Website für SEO und GEO vor. Hinterlassen Sie Ihre E-Mail — wir senden den Link zur fertigen Version, sobald unser Manager sie geprüft hat.",
    astroEmailPlaceholder: "sie@firma.de", astroEmailInvalid: "Bitte geben Sie eine gültige E-Mail-Adresse an",
    astroSubmitting: "Wird gesendet…", astroSubmitBtn: "Ja, interessant",
    astroRequestError: "Anfrage konnte nicht gesendet werden — bitte später erneut versuchen", astroTooManyRequests: "Zu viele Anfragen — bitte später erneut versuchen",
    astroPhonePlaceholder: "Telefon (optional)",
    tgConnectPrompt: "Möchten Sie die Benachrichtigung nicht verpassen? Verbinden Sie Telegram — wir senden den fertigen Link auch dorthin.",
    tgConnectBtn: "Telegram verbinden",
    finalCtaAstroTitle: "Bereit, die neue Website-Version zu sehen?", finalCtaAstroBody: "Ein Schritt — hinterlassen Sie Ihre E-Mail im Block „Neue Website-Version“ oben, und wir erstellen eine Arbeitskopie mit erhaltenem Design.", finalCtaAstroBtn: "Neue Website-Version erstellen",
    finalCtaGenericTitle: "Bereit, in Rankings und Leads zu wachsen?", finalCtaGenericBody: "Wir gehen die Erkenntnisse zu Ihrer Website durch, wählen ein passendes Paket und zeigen eine Ergebnisprognose.", leaveRequestBtn: "Anfrage hinterlassen",
    evidenceFact: "FAKT", evidenceEstimate: "SCHÄTZUNG", evidenceForecast: "PROGNOSE",
    evidenceLegendPrefix: "So lesen Sie den Bericht:",
    evidenceLegendFact: "manuell geprüft, mit Beleg", evidenceLegendEstimate: "Experteneinschätzung anhand indirekter Daten", evidenceLegendForecast: "Rechenmodell mit Spanne — Orientierung für die Planung, keine Garantie",
    footerAutoGenerated: "Analyse automatisch erstellt von der MarketRadar-Plattform · Prognosen sind ein Rechenmodell, als PROGNOSE gekennzeichnet",
  },
};

function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
function ruPluralPoints(n: number): string {
  return ruPlural(n, "балл", "балла", "баллов");
}
