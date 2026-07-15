/**
 * /admin/position-checker — минимальный демо/тест UI для живой проверки
 * позиций сайта в Yandex/Google (см. src/app/api/check-positions/route.ts
 * и src/lib/position-checker.ts).
 *
 * НЕ добавлена в общий nav (TABS) других admin-страниц по требованию
 * задачи — открывается только по прямому URL. Отдельный файл, чтобы не
 * трогать src/app/admin/analysis-requests/page.tsx (там параллельно
 * работает другой инженер).
 */
import { requireAdmin } from "@/app/admin/layout";
import PositionCheckerClient from "./PositionCheckerClient";

export const dynamic = "force-dynamic";

export default async function PositionCheckerPage() {
  await requireAdmin();
  return <PositionCheckerClient />;
}
