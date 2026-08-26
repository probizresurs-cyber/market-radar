// Статические блоки КП: внешний контур (PR), сравнение с рынком и условия.
//
// Почему НЕ через AI, в отличие от остального бандла: эти три блока описывают
// не клиента, а НАС — обязательства, права на материалы, порядок возврата,
// границу «входит / оплачивается сверх». Модель, которой отдать такое в
// генерацию, начинает изобретать гарантии («вернём в двойном размере»,
// «гарантируем топ-1»), и это уже не брак вёрстки, а обещание, которое
// придётся исполнять. Поэтому текст фиксирован в коде и меняется здесь.
//
// Ценовые ориентиры рынка — по открытым прайсам GEO-агентств и отраслевым
// обзорам 2026 года. ПЕРЕПРОВЕРИТЬ перед большой рассылкой: первичный
// источник — обзор рынка, написанный одним из его участников.
import type { KpLocale } from "./kp-generate";
import type { PilotBundle } from "@/components/kp/pilot-sozdavay-data";

type Blocks = Pick<PilotBundle, "pr" | "market" | "terms">;

/**
 * @param seoGeoPrice цена направления СЕО+ГЕО из PRICE_POLICY — строка на
 * языке локали. Подставляется в колонку «у нас», чтобы сравнение с рынком
 * не разошлось с ценой в блоке предложения.
 */
export function kpStaticBlocks(locale: KpLocale, seoGeoPrice: string): Blocks {
  return locale === "de" ? deBlocks() : ruBlocks(seoGeoPrice);
}

function ruBlocks(seoGeoPrice: string): Blocks {
  return {
    pr: {
      intro:
        "Нейросеть цитирует не только ваш сайт. Когда ассистент решает, кого назвать в ответе, он опирается ещё и на внешние источники — отраслевые площадки, каталоги, карточки на картах, отзывы. По разборам генеративной выдачи именно этот слой сильнее всего влияет на частоту цитирования, и причина понятна: содержимое своего сайта вы контролируете полностью, поэтому как аргумент оно весит меньше.",
      why:
        "Это самый долгий слой и единственный, который нельзя ускорить деньгами за месяц: площадки публикуют по своему графику, а вес источника набирается месяцами. Поэтому мы начинаем его в первый же месяц, параллельно с техникой, а не после неё.",
      // ВАЖНО: список обязан совпадать с assistantsExample для ru в
      // kp-generate.ts — иначе глава «покрытие» и таблица «что вознаграждает
      // каждый ассистент» в GEO-секции назовут разные наборы систем.
      coverage:
        "Покрытие — пять систем, которые закрывают русскоязычную аудиторию: Алиса и Яндекс Нейро, ChatGPT, Claude, Perplexity, GigaChat. Работа с одним только ChatGPT отрезала бы большую часть ваших клиентов.",
      platforms: [
        { name: "Дзен", paid: false, kind: "входит", why: "Основной источник для Алисы и Яндекс Нейро. Ведём канал бренда, переупаковываем статьи с сайта под формат площадки." },
        { name: "VK", paid: false, kind: "входит", why: "Russian-first источник для GigaChat. Кросс-постинг материалов и кейсов." },
        { name: "VC.ru и профильные блоги", paid: false, kind: "входит", why: "Экспертные колонки от лица специалистов компании — площадки, которые ChatGPT и Perplexity считают авторитетными." },
        { name: "Яндекс Карты, 2ГИС, Google", paid: false, kind: "входит", why: "Карточка компании с сайтом, категориями и фото. Для Алисы это прямой сигнал, что бизнес существует." },
        { name: "Отраслевые каталоги и отзовики", paid: false, kind: "входит", why: "Тематические каталоги подрядчиков — источник, откуда ассистенты берут списки исполнителей." },
        { name: "Отраслевые СМИ", paid: true, kind: "платно, по счёту площадки", why: "Самый весомый тип упоминания. Размещение оплачивается напрямую площадке — наценку мы не берём и на посредничестве не зарабатываем." },
      ],
      included: [
        "Ведение внешних площадок из списка «входит» — без доплат сверх месячного тарифа",
        "Переупаковка каждой статьи с сайта минимум под две внешние площадки",
        "Единое написание бренда, адреса и описания везде — чтобы ассистент видел один бизнес, а не три разных",
        "Ежемесячный список новых упоминаний со ссылками — проверяемо",
      ],
      paidExtra:
        "Платные размещения в отраслевых СМИ в тариф не входят и оплачиваются по счёту площадки. Наценку не добавляем: сколько выставила площадка — столько и платите. Это ваше решение, а не обязательное условие работы.",
      reputation: {
        title: "Репутация — часть того же контура",
        body:
          "Ассистент не порекомендует компанию с оценкой три звезды: тональность отзывов влияет на попадание в ответ не меньше, чем разметка на сайте. Поэтому в работу входит мониторинг отзывов на картах и отзовиках, шаблоны ответов и разбор повторяющихся тем. Отзывы не покупаем и не пишем — работаем с реальными.",
      },
    },
    market: {
      intro:
        `${seoGeoPrice} — ниже вилки, в которой работают GEO-агентства. За такие деньги рынок обычно продаёт «тариф-галочку»: одно-два действия в месяц и отчёт о проделанной работе. Поэтому разницу показываем в цифрах, а не на словах.`,
      rows: [
        { what: "Разовый аудит AI-видимости", market: "80–250 тыс ₽", ours: "входит в работу", note: "Отдельно аудит не продаём: без него нельзя доказать результат, поэтому он часть старта." },
        { what: "GEO-сопровождение", market: "80–200 тыс ₽/мес", ours: seoGeoPrice, note: "Средний рабочий бюджет по рынку — около 140–160 тыс ₽/мес." },
        { what: "Объём контента", market: "2–4 статьи/мес", ours: "около 30 статей/мес", note: "Одна статья в день, с редакторской вычиткой перед публикацией." },
        { what: "Первые изменения", market: "1–3 месяца", ours: "1–3 месяца", note: "Здесь мы не быстрее. Раньше не бывает ни у кого — и тот, кто обещает быстрее, обманывает." },
      ],
      whyTitle: "За счёт чего дешевле",
      why: [
        { title: "Платформа вместо команды подрядчиков", detail: "Сбор данных, разбор конкурентов, черновики, разметку и замер видимости делает MarketRadar. Человек редактирует и утверждает. Агентство продаёт часы специалистов — мы продаём пропускную способность." },
        { title: "Digital PR без наценки", detail: "Платные размещения идут по счёту площадки напрямую. Обычная практика рынка — перепродавать их с маржой; мы на этом не зарабатываем." },
        { title: "Нет слоя согласований", detail: "Проект ведёт один оператор. Вы не оплачиваете аккаунт-менеджера, координатора и еженедельные созвоны-презентации." },
      ],
      honestTitle: "Чего за эти деньги не будет",
      honest: [
        "Персональной команды из пяти человек и офисных встреч",
        "Еженедельных презентаций в переговорной — отчёт приходит цифрами",
        "Гарантии позиции в ответе нейросети: фиксированных позиций в генеративной выдаче не существует в принципе",
      ],
      sources: "Ориентиры рынка — по открытым прайсам GEO-агентств и отраслевым обзорам 2026 года.",
    },
    terms: {
      intro:
        "Отвечаем на них заранее, чтобы вам не пришлось вытягивать это на созвоне. Если какой-то ответ не устроит — это тоже полезный результат: разойтись сейчас дешевле, чем через три месяца работы.",
      items: [
        { q: "Как фиксируется стартовая точка?", a: "В первый месяц прогоняем набор контрольных вопросов по всем ассистентам из списка покрытия и записываем, кого они называют сейчас. Это база отсчёта: без неё ни мы, ни вы не сможете доказать, что что-то изменилось. Замер повторяется ежемесячно по тому же списку." },
        { q: "Что будет, если через 3 месяца динамики нет?", a: "Садимся с цифрами замера и разбираем причину. Если заявленный объём работ выпущен, а метрика не двинулась — меняем состав работ за свой счёт, без доплаты за пересборку стратегии. Месячные направления в любом случае останавливаются с конца оплаченного месяца: без штрафов и без обязательного срока." },
        { q: "Кому принадлежат материалы после окончания работы?", a: "Всё созданное остаётся у вас: статьи, страницы, разметка, доступы к заведённым площадкам, список контрольных вопросов и вся история замеров. Передаём выгрузкой, ничего не удерживаем." },
        { q: "Что входит в бюджет, а что сверх?", a: "В месячный тариф входит всё, что перечислено в направлениях, включая внешние площадки из списка «входит». Сверх — только платные размещения в отраслевых СМИ, по счёту площадки и по вашему решению." },
        { q: "Что вы гарантируете?", a: "Объём: не выпустим заявленный объём за месяц — вернём оплату этого месяца. Позиции в ответах нейросетей не гарантирует никто: фиксированных мест в генеративной выдаче не существует, а обещание «первое место в ChatGPT» — признак недобросовестного подрядчика." },
      ],
      limitsTitle: "Когда это не окупится",
      limitsIntro: "Говорим прямо, потому что в предложениях об этом обычно молчат. GEO не имеет смысла, если:",
      limits: [
        "Клиенты приходят только по личным рекомендациям и тендерам, а не через поиск.",
        "О нише почти не спрашивают ассистентов. Проверяется за час на старте — если осмысленных ответов нет, мы скажем это до подписания.",
        "Результат нужен через две недели: раньше одного-трёх месяцев динамики не будет.",
        "Готовы вкладываться только в один слой из четырёх. Работает связка — техника, контент, внешние упоминания и репутация вместе.",
      ],
    },
  };
}

function deBlocks(): Blocks {
  return {
    pr: {
      intro:
        "Ein KI-Assistent zitiert nicht nur Ihre Website. Wenn er entscheidet, welchen Namen er in einer Antwort nennt, stützt er sich ebenso auf externe Quellen — Fachportale, Verzeichnisse, Kartendienste, Bewertungen. Auswertungen generativer Antworten zeigen: Genau diese Ebene beeinflusst die Zitierhäufigkeit am stärksten. Der Grund ist naheliegend — die Inhalte Ihrer eigenen Website kontrollieren Sie vollständig, deshalb wiegen sie als Argument weniger.",
      why:
        "Es ist die langsamste Ebene und die einzige, die sich nicht mit Geld auf einen Monat verkürzen lässt: Plattformen veröffentlichen nach eigenem Zeitplan, und das Gewicht einer Quelle baut sich über Monate auf. Deshalb beginnen wir damit im ersten Monat, parallel zur Technik — nicht danach.",
      // Muss mit assistantsExample (de) in kp-generate.ts übereinstimmen —
      // sonst nennen dieses Kapitel und die GEO-Tabelle verschiedene Systeme.
      coverage:
        "Abgedeckt werden fünf Systeme, über die im deutschsprachigen Raum tatsächlich gesucht wird: ChatGPT, Claude, Perplexity, Google Gemini und Microsoft Copilot. Nur ChatGPT zu bearbeiten würde einen Großteil Ihrer Kundschaft ausblenden.",
      platforms: [
        { name: "LinkedIn", paid: false, kind: "enthalten", why: "Fachbeiträge aus dem Unternehmen heraus. Für Modelle ein Autoritätssignal mit klarer Urheberschaft." },
        { name: "Fachportale und Branchenmedien (redaktionell)", paid: false, kind: "enthalten", why: "Beiträge, die ohne Platzierungsgebühr veröffentlicht werden — Gastbeiträge, Expertenkommentare, Interviews." },
        { name: "Google Unternehmensprofil", paid: false, kind: "enthalten", why: "Vollständiges Profil mit Website, Kategorien und Bildern. Direktes Existenzsignal für Google AI Overviews." },
        { name: "Branchenverzeichnisse", paid: false, kind: "enthalten", why: "Fachverzeichnisse für Dienstleister — die Quelle, aus der Assistenten Anbieterlisten zusammenstellen." },
        { name: "Bewertungsportale", paid: false, kind: "enthalten", why: "Profilpflege und Antworten auf Bewertungen. Tonalität entscheidet mit, ob eine Empfehlung ausgesprochen wird." },
        { name: "Bezahlte Fachmedien-Platzierungen", paid: true, kind: "kostenpflichtig, nach Rechnung der Plattform", why: "Die gewichtigste Erwähnungsart. Die Platzierung wird direkt an die Plattform gezahlt — wir erheben keinen Aufschlag." },
      ],
      included: [
        "Betreuung der als enthalten gekennzeichneten Plattformen — ohne Zusatzkosten über den Monatstarif hinaus",
        "Aufbereitung jedes Website-Beitrags für mindestens zwei externe Plattformen",
        "Einheitliche Schreibweise von Marke, Adresse und Beschreibung überall — damit der Assistent ein Unternehmen sieht und nicht drei",
        "Monatliche Liste neuer Erwähnungen mit Links — nachprüfbar",
      ],
      paidExtra:
        "Bezahlte Platzierungen in Fachmedien sind nicht im Tarif enthalten und werden nach Rechnung der Plattform abgerechnet. Wir schlagen nichts auf: Sie zahlen den Betrag, den die Plattform stellt. Das ist Ihre Entscheidung und keine Voraussetzung für die Zusammenarbeit.",
      reputation: {
        title: "Reputation gehört zur selben Ebene",
        body:
          "Ein Assistent empfiehlt kein Unternehmen mit drei Sternen: Die Tonalität der Bewertungen beeinflusst die Aufnahme in eine Antwort nicht weniger als das Markup auf der Website. Deshalb gehören Monitoring der Bewertungen, Antwortvorlagen und die Auswertung wiederkehrender Themen zum Leistungsumfang. Bewertungen kaufen oder schreiben wir nicht — wir arbeiten mit echten.",
      },
    },
    // market: для DE НЕ заполняем. Сравнение с рынком требует проверенных
    // ставок немецких агентств, а наша DE-сетка — прямая конвертация
    // RU-цен (см. PRICE_POLICY), не калибровка под местный рынок. Пока
    // ориентиров нет, глава просто не рендерится — это честнее, чем
    // пересчитать рублёвые вилки в евро и выдать за рынок Германии.
    market: undefined,
    terms: {
      intro:
        "Wir beantworten sie vorab, damit Sie sie nicht im Gespräch herausfragen müssen. Sollte Ihnen eine Antwort nicht zusagen, ist auch das ein nützliches Ergebnis: Jetzt getrennte Wege zu gehen ist günstiger als nach drei Monaten Arbeit.",
      items: [
        { q: "Wie wird der Ausgangspunkt festgehalten?", a: "Im ersten Monat stellen wir allen abgedeckten Assistenten einen festen Satz Kontrollfragen und halten fest, wen sie derzeit nennen. Das ist die Bezugsbasis: Ohne sie kann weder wir noch Sie belegen, dass sich etwas verändert hat. Die Messung wird monatlich mit derselben Liste wiederholt." },
        { q: "Was passiert, wenn sich nach 3 Monaten nichts bewegt?", a: "Wir setzen uns mit den Messzahlen zusammen und klären die Ursache. Wurde der zugesagte Leistungsumfang geliefert und die Kennzahl bewegt sich dennoch nicht, ändern wir den Leistungszuschnitt auf unsere Kosten — ohne Aufpreis für die Neuaufstellung der Strategie. Die monatlichen Leistungen enden ohnehin zum Ende des bezahlten Monats: ohne Vertragsstrafe und ohne Mindestlaufzeit." },
        { q: "Wem gehören die Materialien nach Ende der Zusammenarbeit?", a: "Alles Erstellte bleibt bei Ihnen: Beiträge, Seiten, Markup, Zugänge zu den angelegten Plattformen, die Liste der Kontrollfragen und die vollständige Messhistorie. Wir übergeben es als Export und behalten nichts zurück." },
        { q: "Was ist im Budget enthalten und was kommt obendrauf?", a: "Im Monatstarif ist alles enthalten, was in den Leistungslinien aufgeführt ist, einschließlich der als enthalten gekennzeichneten externen Plattformen. Obendrauf kommen ausschließlich bezahlte Platzierungen in Fachmedien — nach Rechnung der Plattform und nach Ihrer Entscheidung." },
        { q: "Was garantieren Sie?", a: "Den Umfang: Liefern wir den zugesagten Monatsumfang nicht, erstatten wir die Zahlung dieses Monats. Positionen in KI-Antworten garantiert niemand: Feste Plätze in generativen Antworten existieren nicht, und das Versprechen „Platz eins in ChatGPT“ ist ein Kennzeichen unseriöser Anbieter." },
      ],
      limitsTitle: "Wann sich das nicht rechnet",
      limitsIntro: "Wir sagen es offen, weil in Angeboten üblicherweise darüber geschwiegen wird. GEO ergibt keinen Sinn, wenn:",
      limits: [
        "Kundschaft ausschließlich über persönliche Empfehlungen und Ausschreibungen kommt, nicht über die Suche.",
        "Zu Ihrem Themenfeld kaum jemand einen Assistenten fragt. Das prüfen wir zu Beginn innerhalb einer Stunde — gibt es keine sinnvollen Antworten, sagen wir das vor der Unterzeichnung.",
        "Das Ergebnis in zwei Wochen vorliegen soll: Vor einem bis drei Monaten bewegt sich nichts.",
        "Sie nur in eine der vier Ebenen investieren wollen. Wirksam ist das Zusammenspiel — Technik, Inhalte, externe Erwähnungen und Reputation gemeinsam.",
      ],
    },
  };
}
