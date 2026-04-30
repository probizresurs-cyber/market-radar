import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MarketRadar — Кабинет интегратора",
  description: "Личный кабинет интегратора MarketRadar",
};

export default function IntegratorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
