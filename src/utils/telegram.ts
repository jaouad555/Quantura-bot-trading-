export const sendTelegramMessage = async (token: string, chatId: string, message: string) => {
  if (!token || !chatId || !message) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    await fetch('/api/telegram/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        chatId,
        message,
      }),
      signal: controller.signal,
    }).catch(() => {});
    clearTimeout(timeout);
  } catch {
    // Graceful silent fallback
  }
};

