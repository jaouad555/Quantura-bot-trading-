import OpenAI from 'openai';

export interface DeepSeekRequestOptions {
  apiKey: string;
  model?: 'deepseek-chat' | 'deepseek-reasoner';
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Handles API requests to DeepSeek API (OpenAI compatible endpoint at https://api.deepseek.com)
 */
export async function callDeepSeekAPI(options: DeepSeekRequestOptions): Promise<string> {
  const apiKey = options.apiKey || 
    (typeof window !== 'undefined' ? ((import.meta as any).env?.VITE_DEEPSEEK_API_KEY || localStorage.getItem('DEEPSEEK_API_KEY')) : '') || 
    '';
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_DEEPSEEK_API_KEY') {
    throw new Error('DeepSeek API Key is missing or invalid. Please add DEEPSEEK_API_KEY in your .env file.');
  }

  const model = options.model || 'deepseek-chat';
  const openai = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: 'https://api.deepseek.com',
    dangerouslyAllowBrowser: true,
  });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    });

    return completion.choices[0]?.message?.content || 'No response generated from DeepSeek.';
  } catch (error: any) {
    console.error('[DeepSeek API Error]:', error);
    throw new Error(`DeepSeek API error: ${error.message || 'Unknown error'}`);
  }
}
