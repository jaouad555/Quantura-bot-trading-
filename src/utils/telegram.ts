/**
 * Instant, Non-blocking Telegram Notification Dispatcher
 * Communicates with backend proxy and handles immediate fallback
 */
let lastMessage = '';
let lastMessageTime = 0;

export const sendTelegramMessage = (token: string, chatId: string, message: string): Promise<boolean> => {
  if (!token || !chatId || !message) return Promise.resolve(false);

  // Simple de-duplication: if same message sent within 5 seconds, ignore
  const now = Date.now();
  if (message === lastMessage && now - lastMessageTime < 5000) {
    return Promise.resolve(true);
  }
  lastMessage = message;
  lastMessageTime = now;

  return new Promise((resolve) => {
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
  });
};
