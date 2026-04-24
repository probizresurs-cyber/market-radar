// Navigation structure shared between page.tsx and SidebarComponent
// Icons are lucide-react names (see ICON_MAP in SidebarComponent).
export interface NavItem {
  id: string;
  icon: string;         // Lucide icon name, e.g. "LayoutDashboard"
  label: string;
  count: number | null;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// Структура сайдбара разбита на 4 группы для снижения когнитивной нагрузки:
// Обзор / Аналитика / Производство контента / Настройки
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "ОБЗОР",
    items: [
      { id: "owner-dashboard", icon: "Gauge", label: "Дашборд руководителя", count: null },
    ],
  },
  {
    title: "АНАЛИТИКА",
    items: [
      {
        id: "company-analysis", icon: "Building2", label: "Моя компания", count: null,
        children: [
          { id: "new-analysis", icon: "Search", label: "Новый анализ", count: null },
          { id: "dashboard", icon: "TrendingUp", label: "Дашборд", count: null },
          { id: "prev-analyses", icon: "FolderOpen", label: "Предыдущие анализы", count: null },
          { id: "insights", icon: "Lightbulb", label: "AI-инсайты", count: null },
          { id: "ai-visibility", icon: "Eye", label: "AI Видимость", count: null },
        ],
      },
      {
        id: "competitor-analysis", icon: "Swords", label: "Конкуренты", count: null,
        children: [
          { id: "competitors", icon: "Target", label: "Список конкурентов", count: null },
          { id: "compare", icon: "Scale", label: "Сравнение", count: null },
        ],
      },
      {
        id: "ta-analysis", icon: "Brain", label: "Аудитория", count: null,
        children: [
          { id: "ta-new", icon: "Pencil", label: "Новый анализ", count: null },
          { id: "ta-dashboard", icon: "Users", label: "Дашборд ЦА", count: null },
          { id: "ta-cjm", icon: "Map", label: "Customer Journey Map", count: null },
          { id: "ta-benchmarks", icon: "BarChart2", label: "Отраслевые бенчмарки", count: null },
        ],
      },
      {
        id: "smm-analysis", icon: "Share2", label: "СММ", count: null,
        children: [
          { id: "smm-new", icon: "Pencil", label: "Новый анализ", count: null },
          { id: "smm-dashboard", icon: "BarChart3", label: "Дашборд СММ", count: null },
        ],
      },
      { id: "reviews-analysis", icon: "Star", label: "Рынок и отзывы", count: null },
    ],
  },
  {
    title: "ПРОИЗВОДСТВО КОНТЕНТА",
    items: [
      {
        id: "seo-articles", icon: "FileText", label: "SEO-статьи", count: null,
        children: [
          { id: "seo-new",      icon: "Plus",    label: "Новая статья",       count: null },
          { id: "seo-library",  icon: "Library", label: "Библиотека статей",  count: null },
          { id: "seo-keywords", icon: "Key",     label: "Кластер ключей",     count: null },
        ],
      },
      {
        id: "content-factory", icon: "Factory", label: "Контент-завод", count: null,
        children: [
          { id: "content-plan", icon: "ClipboardList", label: "План контента", count: null },
          { id: "content-style", icon: "BookOpen", label: "Стиль компании", count: null },
          { id: "content-posts", icon: "FileEdit", label: "Готовые посты", count: null },
          { id: "content-reels", icon: "Film", label: "Готовые видео", count: null },
          { id: "content-stories", icon: "Smartphone", label: "Сторис-сценарии", count: null },
          { id: "content-carousels", icon: "Layers", label: "Карусель-посты", count: null },
          { id: "content-analytics", icon: "BarChart3", label: "Аналитика контента", count: null },
          { id: "content-roi", icon: "Wallet", label: "ROI калькулятор", count: null },
        ],
      },
      { id: "landing-generator", icon: "Globe", label: "Лендинги", count: null },
      { id: "brand-presentation", icon: "Presentation", label: "Презентации", count: null },
    ],
  },
  {
    title: "НАСТРОЙКИ",
    items: [
      { id: "ta-brandbook", icon: "Palette", label: "Брендбук", count: null },
      { id: "reports", icon: "FileText", label: "Отчёты", count: null },
      { id: "sources", icon: "Link2", label: "Источники", count: null },
      { id: "settings", icon: "Settings", label: "Аккаунт", count: null },
    ],
  },
];
