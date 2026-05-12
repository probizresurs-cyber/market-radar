/**
 * agents/index.ts — entrypoint для всех зарегистрированных агентов.
 *
 * Side-effect импорты: каждый файл агента в импорте регистрирует себя
 * через registerAgent(). Этот файл — единственная точка, где список
 * нужно поддерживать.
 *
 * API routes должны импортировать ИЗ этого файла (а не из registry.ts
 * напрямую), чтобы все агенты были зарегистрированы при обращении.
 *
 *   import { listAgents, runAgent, ... } from "@/lib/agents";
 */

// Сначала экспортируем сам registry — это безопасно, файлы агентов
// импортируют registerAgent из ./registry, не из этого файла
// (избегаем circular).
export * from "./registry";

// Side-effect import всех агентов. ORDER МАТТЕРИТ если есть зависимости
// между ними (сейчас нет, но на будущее).
import "./auto-publisher";
import "./yandex-reviews-watcher";
import "./email-drip-sender";
import "./site-change-detector";
import "./trend-hunter";
