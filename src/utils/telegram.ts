/**
 * Instant, Non-blocking Telegram Notification Dispatcher
 * Communicates with backend proxy and handles immediate fallback
 */
export const sendTelegramMessage = (token: string, chatId: string, message: string): Promise<boolean> => {
  if (!token || !chatId || !message) return Promise.resolve(false);

  return new Promise((resolve) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      fetch('/api/telegram/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token.trim(),
          chatId: chatId.trim(),
          message: String(message),
        }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          clearTimeout(timeout);
          resolve(Boolean(data?.success));
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve(false);
        });
    } catch {
      resolve(false);
    }
  });
};
