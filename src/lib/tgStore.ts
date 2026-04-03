// In-memory store: code → chatId (works on Railway persistent server)
const store = new Map<string, number>();

export function saveChatId(code: string, chatId: number) {
  store.set(code.toUpperCase(), chatId);
  // Auto-cleanup after 10 minutes
  setTimeout(() => store.delete(code.toUpperCase()), 10 * 60 * 1000);
}

export function getChatId(code: string): number | null {
  return store.get(code.toUpperCase()) ?? null;
}
