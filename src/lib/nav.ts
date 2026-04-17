// Navigation structure shared between page.tsx and SidebarComponent
export interface NavItem {
  id: string;
  icon: string;
  label: string;
  count: number | null;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "МАРКЕТИНГ",
    items: [
      { id: "owner-dashboard", icon: "🎯", label: "Дашборд руководителя", count: null },
      {
        id: "company-analysis", icon: "🏢", label: "Анализ компании", count: null,
        children: [
          { id: "new-analysis", icon: "🔎", label: "Новый анализ", count: null },
          { id: "dashboard", icon: "📈", label: "Дашборд", count: null },
          { id: "prev-analyses", icon: "📂", label: "Предыдущие анализы", count: null },
        ],
      },
      {
        id: "competitor-analysis", icon: "📊", label: "Анализ конкурентов", count: null,
        children: [
          { id: "competitors", icon: "🎯", label: "Конкуренты", count: null },
          { id: "compare", icon: "⚖️", label: "Сравнение", count: null },
          { id: "insights", icon: "💡", label: "AI-инсайты", count: null },
        ],
      },
      {
        id: "ta-analysis", icon: "🧠", label: "Анализ ЦА", count: null,
        children: [
          { id: "ta-new", icon: "✏️", label: "Новый анализ", count: null },
          { id: "ta-dashboard", icon: "👥", label: "Дашборд ЦА", count: null },
          { id: "ta-cjm", icon: "🗺️", label: "Customer Journey Map", count: null },
          { id: "ta-benchmarks", icon: "📊", label: "Отраслевые бенчмарки", count: null },
          { id: "ta-brandbook", icon: "🎨", label: "Рекомендации бренда", count: null },
        ],
      },
      {
        id: "smm-analysis", icon: "📱", label: "Анализ СММ", count: null,
        children: [
          { id: "smm-new", icon: "✏️", label: "Новый анализ", count: null },
          { id: "smm-dashboard", icon: "🎨", label: "Дашборд СММ", count: null },
        ],
      },
      {
        id: "content-factory", icon: "🏭", label: "Контент-завод", count: null,
        children: [
          { id: "content-plan", icon: "📋", label: "План контента", count: null },
          { id: "content-posts", icon: "📝", label: "Готовые посты", count: null },
          { id: "content-reels", icon: "🎬", label: "Готовые видео", count: null },
          { id: "content-stories", icon: "📱", label: "Сторис-сценарии", count: null },
          { id: "content-analytics", icon: "📊", label: "Аналитика контента", count: null },
          { id: "content-roi", icon: "💰", label: "ROI калькулятор", count: null },
        ],
      },
      {
        id: "seo-articles", icon: "✍️", label: "SEO-статьи", count: null,
        children: [
          { id: "seo-new",      icon: "➕", label: "Новая статья",       count: null },
          { id: "seo-library",  icon: "📚", label: "Библиотека статей",  count: null },
          { id: "seo-keywords", icon: "🔑", label: "Кластер ключей",     count: null },
        ],
      },
      { id: "reviews-analysis", icon: "⭐", label: "Анализ отзывов", count: null },
      { id: "brand-presentation", icon: "🎤", label: "Презентация бренда", count: null },
      { id: "landing-generator", icon: "🌐", label: "Генератор лендингов", count: null },
      { id: "reports", icon: "📄", label: "Отчёты", count: null },
      { id: "sources", icon: "🔗", label: "Источники", count: null },
    ],
  },
  {
    title: "СИСТЕМА",
    items: [
      { id: "settings", icon: "⚙️", label: "Настройки", count: null },
    ],
  },
];


