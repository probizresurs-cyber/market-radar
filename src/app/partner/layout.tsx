import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MarketRadar — Партнёрская программа",
  description: "Личный кабинет партнёра MarketRadar",
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
