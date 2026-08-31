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
  heroLossFrame: (range: string) => string;
  heroKicker: string; heroPotentialLabel: string; heroProblemLabel: string; offerAddonLabel: string; navDeeper: string; deeperTitle: string; deeperSubtitle: string;
  lhPassport: string; interestTechRebuild: string; whyRivalsAhead: (n: number) => string; whyCriticalFirst: (n: number) => string; whyNoCritical: string;
  finalCritCount: (n: number) => string; finalGrowthCount: (n: number) => string; finalCtaCost: string; heroDiscussBtn: string; heroOfferBtnPrefix: string;
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
  socialTitle: string; socialSubtitle: string; navSocial: string;
  showMoreFindings: (n: number) => string; collapseFindings: string;
  showMoreQuestions: (n: number) => string; collapseQuestions: string;
  showAssumptions: string; collapseAssumptions: string;
  geoAssistantRewardsTitle: string;
  geoLeversTitle: string;
  geoMethodTitle: string; geoMethodQuestionsLabel: string;
  geoForecastTitle: string;
  rivalGapLabel: string; rivalGapPerMonth: string; rivalGapNote: string;
  navPr: string; navMarket: string; navTerms: string; navMore: string;
  moreTitle: string; moreSubtitle: string;
  moreItems: { t: string; d: string }[];
  consultTitle: string; consultBody: string; consultBtn: string;
  serviceFormTitle: string; serviceFormBody: string; serviceFormBtn: string; serviceFormDone: string;
  finalCtaServiceTitle: string; finalCtaServiceBody: string; finalCtaServiceBtn: string;
  prTitle: string; prSubtitle: string;
  prCoverageLabel: string; prPlatformsLabel: string; prIncludedLabel: string; prExtraLabel: string;
  marketTitle: string; marketSubtitle: string;
  marketColWhat: string; marketColMarket: string; marketColOurs: string;
  termsTitle: string; termsSubtitle: string;
  positionsTitleEngine: (engine: string) => string;
  positionsOutOfTop30: string; positionsCheckFailed: string; positionsDiagnosisLabel: string;
  savingsHeadlineFallback: string;
  marketerInStaff: string; marketerNote: string; ourTeamLabel: string; ourNoteFallback: string;
  offerStartTitle: string; offerStartSubtitle: string;
  offerIncludes: string; offerGets: string; offerWhyPrice: string;
  offerMonthlyLabel: string; offerTimelineLabel: string; offerStartBtn: string;
  /** Варианты копирайта, когда разовый оффер скрыт (быстрый сайт). */
  offerStartSubtitleMonthlyOnly: string; offerMonthlyLabelAlone: string; offerTotalMonthlyOnly: string;
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
  /**
   * Согласие на обработку ПД — четыре куска по инструкции юриста:
   * «Даю [согласие] на обработку … в соответствии с [Политикой …]», где
   * ОБА выделенных слова — гиперссылки: согласие → /legal/consent-pd,
   * Политика → /legal/privacy. Раньше ссылка была одна (на политику) —
   * этого по инструкции недостаточно.
   */
  astroConsentP1: string; astroConsentLink1: string;
  astroConsentP2: string; astroConsentLink2: string;
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
    navCompetitors: "Конкуренты", navRivals: "Куда уходят клиенты", navAiVisibility: "AI-видимость", navGeo: "GEO-видимость",
    navPositions: "Позиции", navOffer: "Предложение", navFormat: "Формат работ", navForecast: "Прогноз",
    navAstroOffer: "Новая версия сайта", navCta: "Заявка",
    themeLight: "Светлая тема", themeDark: "Тёмная тема",
    brandSuffix: "Анализ",
    heroLossFrame: (r) => `Пока этого нет — те же ${r} заявок в месяц получают конкуренты. Каждый месяц ожидания стоит вам этой разницы.`,
    heroKicker: "Интерактивный анализ сайта", heroPotentialLabel: "Потенциал после устранения находок",
    heroProblemLabel: "Главное, что мешает прямо сейчас",
    offerAddonLabel: "Дополнительно, по желанию",
    navDeeper: "Что ещё разберём",
    deeperTitle: "Что ещё разберём в работе",
    deeperSubtitle: "Здесь — проблемы, требующие срочного решения. За ними стоит слой глубже, который тоже влияет на заявки.",
    lhPassport: "Замер:",
    interestTechRebuild: "Техническая пересборка сайта",
    whyRivalsAhead: (n) => `${n} ${n === 1 ? "конкурент стоит" : n < 5 ? "конкурента стоят" : "конкурентов стоят"} выше вас по вашим же запросам`,
    whyCriticalFirst: (n) => `${n} ${n === 1 ? "находка требует" : n < 5 ? "находки требуют" : "находок требуют"} решения в первую очередь`,
    whyNoCritical: "Критичных проблем не нашли — работаем на точках роста",
    finalCritCount: (n) => `${n} ${n === 1 ? "критичная проблема" : n < 5 ? "критичные проблемы" : "критичных проблем"} — требуют решения сейчас`,
    finalGrowthCount: (n) => `${n} ${n === 1 ? "точка роста" : n < 5 ? "точки роста" : "точек роста"} — работает, но недобирает`,
    finalCtaCost: "Пока эти проблемы не закрыты, спрос вашей ниши каждый день делят те, кого клиент находит первыми. Это не разовая потеря — она повторяется ежедневно и накапливается.",
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
    findingsTitle: "Где сайт теряет заявки — с доказательствами", findingsSubtitle: "Каждая точка потерь: что происходит → во что это обходится → что делать → что это вернёт",
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
    rivalsTitle: "Куда уходят ваши клиенты", rivalsSubtitle: "Сайты из топа выдачи, которые забирают спрос вашей ниши. У каждого — что забираем обратно",
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
    navSocial: "Соцсети",
    showMoreFindings: (n) => `Показать ещё ${n} ${n % 10 === 1 && n % 100 !== 11 ? "находку" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "находки" : "находок"}`,
    collapseFindings: "Свернуть находки",
    showMoreQuestions: (n) => `Показать все ${n} контрольных вопросов`,
    collapseQuestions: "Свернуть вопросы",
    showAssumptions: "Допущения и пример расчёта",
    collapseAssumptions: "Свернуть допущения",
    socialTitle: "Соцсети: что есть сейчас", socialSubtitle: "Разбор каналов бренда по реальным данным — подписчики, активность и что с этим делать",
    geoAssistantRewardsTitle: "Что вознаграждает каждый ассистент",
    geoLeversTitle: "Чем мы поднимаем цитируемость",
    geoMethodTitle: "Как честно замеряем результат", geoMethodQuestionsLabel: "Примеры контрольных вопросов",
    geoForecastTitle: "Прогноз по GEO-каналу",
    rivalGapLabel: "Спрос, который забирает конкурент",
    rivalGapPerMonth: "показов/мес",
    rivalGapNote: "Запросы, по которым конкурент в выдаче есть, а вас нет. Частотность — Букварикс, позиция конкурента на момент замера.",
    navMore: "Что ещё умеем",
    moreTitle: "Что ещё умеет платформа",
    moreSubtitle: "Предложение выше — про поиск и нейросети. Это не всё, что можно закрыть одним подрядчиком",
    moreItems: [
      { t: "Видео-ролики с аватаром", d: "Говорящий аватар, озвучка клонированным голосом бренда, видеоряд, субтитры, фирменные цвета из брендбука." },
      { t: "Соцсети под ключ", d: "Посты, сторис, карусели и публикация по расписанию. Контент снимаете вы — упаковка и план наши." },
      { t: "Портрет аудитории", d: "Сегменты, страхи, мотивы и возражения ваших покупателей — основа для текстов, которые попадают." },
      { t: "Брендбук и презентации", d: "Банк проверенных фактов о компании и фотобанк: генерация опирается на ваши данные, а не на выдумку." },
      { t: "Анализ отзывов", d: "Что пишут о вас на картах и отзовиках, темы претензий и шаблоны ответов. Тональность влияет на ответ ассистента." },
      { t: "Мониторинг конкурентов", d: "Их офферы, цены и структура сайтов. Видно, когда сосед по нише меняет условия." },
    ],
    // Главный конвертер документа. Формулировки продают то же, что лендинг:
    // видимость в поиске и в ответах нейросетей, а не переверстку сайта.
    serviceFormTitle: "Начать продвижение в поиске и нейросетях",
    serviceFormBody:
      "Берём находки из этого разбора и закрываем их четырьмя слоями сразу: техника сайта, " +
      "контент под извлечение ответа, внешние упоминания и репутация. Один подрядчик, один счёт, " +
      "отчёт с замерами каждый месяц. От 25 000 ₽/мес, первые изменения — через один-три месяца.",
    serviceFormBtn: "Обсудить сопровождение",
    serviceFormDone: "Заявка принята",
    finalCtaServiceTitle: "Готовы, чтобы вас находили — и советовали?",
    finalCtaServiceBody:
      "Разбор показал, где вы теряете обращения. Дальше это можно чинить самим по списку выше — " +
      "или отдать нам и получать отчёт с замерами каждый месяц.",
    finalCtaServiceBtn: "Начать сопровождение",
    consultTitle: "Не готовы решать с листа?",
    consultBody: "Разберём документ вместе: что делать первым, что подождёт, и во что это встанет именно у вас. Без обязательств.",
    consultBtn: "Запросить консультацию",
    navPr: "Внешний контур", navMarket: "Мы и рынок", navTerms: "Условия",
    prTitle: "Внешний контур: упоминания, PR и репутация",
    prSubtitle: "Третий и четвёртый слои GEO — то, что о бренде пишут вовне. Сайт даёт право быть найденным, внешний контур — право быть рекомендованным",
    prCoverageLabel: "Покрытие ассистентов",
    prPlatformsLabel: "Площадки и что с ними делаем",
    prIncludedLabel: "Что входит в месячный тариф",
    prExtraLabel: "Что оплачивается сверх",
    marketTitle: "Мы и рынок: почему цена такая",
    marketSubtitle: "Наш ценник ниже вилки GEO-агентств — объясняем разницу прямо, вместе с тем, чего за эти деньги не будет",
    marketColWhat: "Что", marketColMarket: "По рынку", marketColOurs: "У нас",
    termsTitle: "Условия и честные ограничения",
    termsSubtitle: "Вопросы, которые отраслевые чек-листы советуют задать GEO-подрядчику до подписания — вместе с тем, когда работа не окупится",
    positionsTitleEngine: (engine) => `Позиции в поиске — живая проверка в ${engine}`,
    positionsOutOfTop30: "вне топ-30", positionsCheckFailed: "не удалось проверить", positionsDiagnosisLabel: "Диагноз:",
    savingsHeadlineFallback: "Столько же работы — в разы дешевле штатного маркетолога",
    marketerInStaff: "Маркетолог в штате", marketerNote: "+ налоги, отпуск, обучение, риск «не сработается»",
    ourTeamLabel: "MarketRadar — команда + AI", ourNoteFallback: "Отчёт с цифрами каждую неделю, гарантия возврата за месяц",
    offerStartTitle: "С чего предлагаем начать", offerStartSubtitle: "Разовый вход с фиксированной ценой + два месячных направления",
    offerIncludes: "Что входит", offerGets: "Что получите", offerWhyPrice: "Почему такая цена:",
    offerStartSubtitleMonthlyOnly: "Два месячных направления — без разовых работ: техническая база сайта в порядке",
    offerMonthlyLabelAlone: "Месячные направления",
    offerTotalMonthlyOnly: "Работаем помесячно, по результату. Разовых работ по сайту не требуется — техническая база в порядке.",
    offerMonthlyLabel: "Дальше — помесячно", offerTimelineLabel: "Что происходит после старта", offerStartBtn: "Обсудить старт",
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
    unitEconEntryFallback: "Разовый вход за ускорение сайта: окупается с первого договора.",
    astroOfferTitle: "Техническое обновление сайта — дизайн остаётся вашим", astroOfferSubtitle: "Устраним технические проблемы из находок выше и подготовим сайт к SEO и GEO. Внешний вид не меняется — 1:1",
    astroDone: "Готово — ссылка у вас на почте", astroDoneBody: (email) => `Мы собрали новую версию сайта и отправили ссылку на ${email}. Если письма нет — проверьте папку «Спам» или напишите нам.`,
    astroDoneReady: "Новая версия сайта готова", astroDoneReadyBody: (email) => `Откройте её по кнопке ниже. Копию ссылки мы также отправили на ${email}.`, astroOpenSiteBtn: "Открыть новый сайт",
    astroInProgress: "Собираем новую версию сайта", astroInProgressBody: (email) => `Обычно это занимает около 1 дня. Как только всё будет готово и проверено, пришлём ссылку на ${email}.`,
    astroPitch: "Дизайн останется точно таким же — меняется только «внутряк»: устраняем технические проблемы из находок выше и готовим сайт к SEO и GEO. Оставьте email — пришлём ссылку на готовую версию, как только менеджер её проверит.",
    astroEmailPlaceholder: "you@company.ru", astroEmailInvalid: "Укажите корректный email",
    astroSubmitting: "Отправляем…", astroSubmitBtn: "Да, интересно",
    astroRequestError: "Не получилось отправить запрос — попробуйте позже", astroTooManyRequests: "Слишком много запросов — попробуйте позже",
    astroPhonePlaceholder: "Телефон (необязательно)",
    astroConsentP1: "Даю",
    astroConsentLink1: "согласие",
    astroConsentP2: "на обработку персональных данных в соответствии с",
    astroConsentLink2: "Политикой обработки персональных данных",
    tgConnectPrompt: "Не хотите пропустить уведомление? Подключите Telegram — пришлём готовую ссылку туда же.",
    tgConnectBtn: "Подключить Telegram",
    finalCtaAstroTitle: "Готовы к технически сильному сайту?", finalCtaAstroBody: "Один шаг — оставьте email в блоке «Новая версия сайта» выше. Мы подготовим технически обновлённую версию: дизайн без изменений, проблемы из находок устранены.", finalCtaAstroBtn: "Запросить обновление сайта",
    finalCtaGenericTitle: "Готовы вырасти в выдаче и лидах?", finalCtaGenericBody: "Разберём находки по вашему сайту, подберём пакет под задачи и покажем прогноз результата.", leaveRequestBtn: "Оставить заявку",
    evidenceFact: "ФАКТ", evidenceEstimate: "ОЦЕНКА", evidenceForecast: "ПРОГНОЗ",
    evidenceLegendPrefix: "Как читать отчёт:",
    evidenceLegendFact: "проверено вручную, есть доказательство", evidenceLegendEstimate: "экспертная оценка по косвенным данным", evidenceLegendForecast: "расчётная модель с вилкой — ориентир для планирования, не гарантия",
    footerAutoGenerated: "Анализ сгенерирован автоматически платформой MarketRadar · прогнозы — расчётная модель, помечены как ПРОГНОЗ",
  },
  de: {
    navOverview: "Übersicht", navStrengths: "Stärken", navFindings: "Erkenntnisse", navTech: "Technik-Audit",
    navCompetitors: "Wettbewerber", navRivals: "Kundenabfluss", navAiVisibility: "KI-Sichtbarkeit", navGeo: "GEO-Sichtbarkeit",
    navPositions: "Positionen", navOffer: "Angebot", navFormat: "Arbeitsformat", navForecast: "Prognose",
    navAstroOffer: "Neue Website-Version", navCta: "Anfrage",
    themeLight: "Heller Modus", themeDark: "Dunkler Modus",
    brandSuffix: "Analyse",
    heroLossFrame: (r) => `Solange das nicht behoben ist, gehen dieselben ${r} Anfragen pro Monat an Wettbewerber. Jeder Monat Wartezeit kostet Sie genau diese Differenz.`,
    heroKicker: "Interaktive Website-Analyse", heroPotentialLabel: "Potenzial nach Behebung der Erkenntnisse",
    heroProblemLabel: "Was aktuell am meisten kostet",
    offerAddonLabel: "Optionale Ergänzung",
    navDeeper: "Was wir noch prüfen",
    deeperTitle: "Was wir in der Zusammenarbeit noch prüfen",
    deeperSubtitle: "Hier stehen die dringenden Probleme. Dahinter liegt eine tiefere Ebene, die ebenfalls auf Anfragen wirkt.",
    lhPassport: "Messung:",
    interestTechRebuild: "Technische Neuaufsetzung der Website",
    whyRivalsAhead: (n) => `${n} ${n === 1 ? "Wettbewerber steht" : "Wettbewerber stehen"} bei Ihren eigenen Suchanfragen über Ihnen`,
    whyCriticalFirst: (n) => `${n} ${n === 1 ? "Erkenntnis verlangt" : "Erkenntnisse verlangen"} zuerst eine Lösung`,
    whyNoCritical: "Keine kritischen Probleme gefunden — wir arbeiten an Wachstumspunkten",
    finalCritCount: (n) => `${n} kritische ${n === 1 ? "Schwachstelle" : "Schwachstellen"} — jetzt zu lösen`,
    finalGrowthCount: (n) => `${n} ${n === 1 ? "Wachstumspunkt" : "Wachstumspunkte"} — funktioniert, schöpft aber nicht aus`,
    finalCtaCost: "Solange diese Punkte offen sind, teilen die Nachfrage Ihrer Nische täglich diejenigen auf, die der Kunde zuerst findet. Kein einmaliger Verlust — er wiederholt sich jeden Tag.",
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
    findingsTitle: "Wo Ihre Website Anfragen verliert — mit Belegen", findingsSubtitle: "Jeder Verlustpunkt: was passiert → was es Sie kostet → was zu tun ist → was es zurückbringt",
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
    rivalsTitle: "Wohin Ihre Kunden abwandern", rivalsSubtitle: "Websites aus den Top-Suchergebnissen, die die Nachfrage Ihrer Nische abschöpfen. Zu jeder: was wir zurückholen",
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
    navSocial: "Social Media",
    showMoreFindings: (n) => `Weitere ${n} Befunde anzeigen`,
    collapseFindings: "Befunde einklappen",
    showMoreQuestions: (n) => `Alle ${n} Kontrollfragen anzeigen`,
    collapseQuestions: "Fragen einklappen",
    showAssumptions: "Annahmen und Rechenbeispiel",
    collapseAssumptions: "Annahmen einklappen",
    socialTitle: "Social Media: der aktuelle Stand", socialSubtitle: "Analyse der Markenkanäle anhand realer Daten — Abonnenten, Aktivität und die nächsten Schritte",
    geoAssistantRewardsTitle: "Was jeder Assistent belohnt",
    geoLeversTitle: "Womit wir die Zitierhäufigkeit steigern",
    geoMethodTitle: "So messen wir das Ergebnis ehrlich", geoMethodQuestionsLabel: "Beispiele für Testfragen",
    geoForecastTitle: "Prognose für den GEO-Kanal",
    rivalGapLabel: "Nachfrage, die der Wettbewerber abschöpft",
    rivalGapPerMonth: "Abfragen/Monat",
    rivalGapNote: "Suchanfragen, bei denen der Wettbewerber in den Ergebnissen steht und Sie nicht. Häufigkeit laut Bukvarix, Position des Wettbewerbers zum Messzeitpunkt.",
    navMore: "Weitere Leistungen",
    moreTitle: "Was die Plattform außerdem kann",
    moreSubtitle: "Das Angebot oben betrifft Suche und KI-Antworten. Das ist nicht alles, was sich über einen Dienstleister abdecken lässt",
    moreItems: [
      { t: "Videos mit Avatar", d: "Sprechender Avatar, Vertonung mit geklonter Markenstimme, Bildmaterial, Untertitel, Markenfarben aus dem Brandbook." },
      { t: "Social Media komplett", d: "Posts, Stories, Karussells und Veröffentlichung nach Plan. Das Material drehen Sie — Aufbereitung und Redaktionsplan kommen von uns." },
      { t: "Zielgruppenprofil", d: "Segmente, Ängste, Motive und Einwände Ihrer Kundschaft — die Grundlage für Texte, die treffen." },
      { t: "Brandbook und Präsentationen", d: "Faktenbank und Bildarchiv Ihres Unternehmens: die Generierung stützt sich auf Ihre Daten, nicht auf Erfundenes." },
      { t: "Bewertungsanalyse", d: "Was auf Karten und Bewertungsportalen über Sie steht, wiederkehrende Beschwerdethemen und Antwortvorlagen." },
      { t: "Wettbewerbsbeobachtung", d: "Angebote, Preise und Seitenstruktur der Mitbewerber. Sichtbar, wenn jemand seine Konditionen ändert." },
    ],
    serviceFormTitle: "Sichtbarkeit in Suche und KI-Antworten starten",
    serviceFormBody:
      "Wir nehmen die Befunde aus dieser Analyse und schließen sie auf vier Ebenen zugleich: " +
      "Technik, Inhalte für die Antwortextraktion, externe Erwähnungen und Reputation. " +
      "Ein Dienstleister, eine Rechnung, monatlicher Bericht mit Messwerten.",
    serviceFormBtn: "Betreuung besprechen",
    serviceFormDone: "Anfrage angenommen",
    finalCtaServiceTitle: "Bereit, gefunden und empfohlen zu werden?",
    finalCtaServiceBody:
      "Die Analyse zeigt, wo Anfragen verloren gehen. Sie können das selbst abarbeiten — " +
      "oder uns übergeben und monatlich einen Bericht mit Messwerten bekommen.",
    finalCtaServiceBtn: "Betreuung starten",
    consultTitle: "Nicht bereit, direkt zu entscheiden?",
    consultBody: "Wir gehen das Dokument gemeinsam durch: was zuerst, was warten kann und was es bei Ihnen konkret kostet. Unverbindlich.",
    consultBtn: "Beratung anfragen",
    navPr: "Externes Umfeld", navMarket: "Wir und der Markt", navTerms: "Konditionen",
    prTitle: "Externes Umfeld: Erwähnungen, PR und Reputation",
    prSubtitle: "Die dritte und vierte Ebene von GEO — das, was extern über die Marke geschrieben wird. Die Website verschafft das Recht, gefunden zu werden; das externe Umfeld das Recht, empfohlen zu werden",
    prCoverageLabel: "Abgedeckte Assistenten",
    prPlatformsLabel: "Plattformen und was wir dort tun",
    prIncludedLabel: "Im Monatstarif enthalten",
    prExtraLabel: "Was zusätzlich berechnet wird",
    marketTitle: "Wir und der Markt: warum der Preis so ist",
    marketSubtitle: "Unser Preis liegt unter der Spanne der GEO-Agenturen — wir erklären den Unterschied offen, samt dem, was es für dieses Geld nicht geben wird",
    marketColWhat: "Leistung", marketColMarket: "Marktüblich", marketColOurs: "Bei uns",
    termsTitle: "Konditionen und ehrliche Grenzen",
    termsSubtitle: "Fragen, die Branchen-Checklisten vor der Unterzeichnung an einen GEO-Dienstleister empfehlen — samt der Frage, wann sich die Arbeit nicht rechnet",
    positionsTitleEngine: (engine) => `Suchpositionen — Live-Prüfung bei ${engine}`,
    positionsOutOfTop30: "außerhalb Top 30", positionsCheckFailed: "Prüfung fehlgeschlagen", positionsDiagnosisLabel: "Diagnose:",
    savingsHeadlineFallback: "Gleiche Arbeit — ein Bruchteil der Kosten eines Inhouse-Marketers",
    marketerInStaff: "Inhouse-Marketer", marketerNote: "+ Steuern, Urlaub, Einarbeitung, Risiko einer Fehlbesetzung",
    ourTeamLabel: "MarketRadar — Team + KI", ourNoteFallback: "Wöchentlicher Bericht mit Zahlen, Geld-zurück-Garantie nach einem Monat",
    offerStartTitle: "Womit wir vorschlagen zu beginnen", offerStartSubtitle: "Einmaliger Einstieg zum Festpreis + zwei monatliche Leistungslinien",
    offerIncludes: "Was enthalten ist", offerGets: "Was Sie erhalten", offerWhyPrice: "Warum dieser Preis:",
    offerStartSubtitleMonthlyOnly: "Zwei monatliche Leistungslinien — ohne einmalige Arbeiten: die technische Basis der Website ist in Ordnung",
    offerMonthlyLabelAlone: "Monatliche Leistungslinien",
    offerTotalMonthlyOnly: "Wir arbeiten monatlich, ergebnisorientiert. Einmalige Arbeiten an der Website sind nicht nötig — die technische Basis stimmt.",
    offerMonthlyLabel: "Danach — monatlich", offerTimelineLabel: "Was nach dem Start passiert", offerStartBtn: "Jetzt starten",
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
    unitEconEntryFallback: "Einmaliger Einstieg für die technische Modernisierung: amortisiert sich ab dem ersten Vertrag.",
    astroOfferTitle: "Technische Modernisierung — Ihr Design bleibt unverändert", astroOfferSubtitle: "Wir beheben die technischen Probleme aus den obigen Erkenntnissen und bereiten die Website für SEO und GEO vor. Das Erscheinungsbild bleibt 1:1 erhalten",
    astroDone: "Fertig — der Link ist in Ihrem Postfach", astroDoneBody: (email) => `Wir haben die neue Version der Website erstellt und den Link an ${email} gesendet. Falls keine E-Mail ankommt — prüfen Sie den Spam-Ordner oder schreiben Sie uns.`,
    astroDoneReady: "Die neue Version der Website ist fertig", astroDoneReadyBody: (email) => `Öffnen Sie sie über den Button unten. Eine Kopie des Links haben wir auch an ${email} gesendet.`, astroOpenSiteBtn: "Neue Website öffnen",
    astroInProgress: "Wir erstellen die neue Version der Website", astroInProgressBody: (email) => `Das dauert normalerweise etwa 1 Tag. Sobald alles fertig und geprüft ist, senden wir den Link an ${email}.`,
    astroPitch: "Das Design bleibt exakt gleich — wir übertragen nur die technische Basis: wir beheben die technischen Probleme aus den obigen Erkenntnissen und bereiten die Website für SEO und GEO vor. Hinterlassen Sie Ihre E-Mail — wir senden den Link zur fertigen Version, sobald unser Manager sie geprüft hat.",
    astroEmailPlaceholder: "sie@firma.de", astroEmailInvalid: "Bitte geben Sie eine gültige E-Mail-Adresse an",
    astroSubmitting: "Wird gesendet…", astroSubmitBtn: "Ja, interessant",
    astroRequestError: "Anfrage konnte nicht gesendet werden — bitte später erneut versuchen", astroTooManyRequests: "Zu viele Anfragen — bitte später erneut versuchen",
    astroPhonePlaceholder: "Telefon (optional)",
    astroConsentP1: "Ich gebe meine",
    astroConsentLink1: "Einwilligung",
    astroConsentP2: "zur Verarbeitung personenbezogener Daten gemäß der",
    astroConsentLink2: "Datenschutzerklärung",
    tgConnectPrompt: "Möchten Sie die Benachrichtigung nicht verpassen? Verbinden Sie Telegram — wir senden den fertigen Link auch dorthin.",
    tgConnectBtn: "Telegram verbinden",
    finalCtaAstroTitle: "Bereit für eine technisch stärkere Website?", finalCtaAstroBody: "Ein Schritt — hinterlassen Sie Ihre E-Mail im Block „Neue Website-Version“ oben. Wir bereiten eine technisch optimierte Version vor — das Design bleibt unverändert.", finalCtaAstroBtn: "Technische Optimierung anfragen",
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
