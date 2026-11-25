export interface AIRequestContext {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  preferredLanguageName: string;
  interactionStyle: 'CONVERSATIONAL' | 'TASK_FOCUSED' | 'BALANCED';
  sanitizedContextLines: string;
  totalWaterMl: number;
  hydrationTargetMl: number;
  verifiedFallbackReply: string;
}

export interface AIProviderResponse {
  reply: string;
  source: 'groq' | 'gemini' | 'local-fallback';
  factGrounded: boolean;
}

export interface AIProvider {
  readonly id: 'groq' | 'gemini' | 'local-fallback';
  generateReply(ctx: AIRequestContext): Promise<AIProviderResponse>;
}

/**
 * Strips direct PII (emails, phone numbers, coordinates) before leaving our boundary.
 */
export function stripDirectPii(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
    .replace(/\+?\d[\d\s\-()]{7,16}\d/g, '[phone-redacted]')
    .replace(/-?\d{1,3}\.\d{3,},\s*-?\d{1,3}\.\d{3,}/g, '[location-redacted]');
}

function buildSystemPrompt(ctx: AIRequestContext): string {
  const brevityRule =
    ctx.interactionStyle === 'TASK_FOCUSED'
      ? 'Keep responses extremely short and action-oriented (1-2 brief sentences).'
      : 'Keep responses warm, calm, clear, and concise (1-3 short sentences).';

  return [
    `You are Smriti, a gentle voice-first companion for an older adult with memory difficulties.`,
    `Respond in ${ctx.preferredLanguageName} unless the user speaks another language. If uncertain in a dialect, respond in very simple warm English.`,
    brevityRule,
    `SAFETY GUARDRAILS:`,
    `- NEVER diagnose dementia or suggest medication dosage changes.`,
    `- NEVER invent family members, personal memories, or events missing from the verified context below.`,
    `- NEVER state that a medication was taken unless the verified context shows an explicit TAKEN event.`,
    `- NEVER claim an SOS alert or phone call succeeded.`,
    `--- VERIFIED NON-PII CARE CONTEXT ---`,
    `Hydration today: ${ctx.totalWaterMl} ml / ${ctx.hydrationTargetMl} ml target`,
    ctx.sanitizedContextLines,
    `-------------------------------------`,
  ].join('\n');
}

export class LocalFallbackAIProvider implements AIProvider {
  readonly id = 'local-fallback' as const;

  async generateReply(ctx: AIRequestContext): Promise<AIProviderResponse> {
    return {
      reply: ctx.verifiedFallbackReply,
      source: 'local-fallback',
      factGrounded: true,
    };
  }
}

export class GroqAIProvider implements AIProvider {
  readonly id = 'groq' as const;

  async generateReply(ctx: AIRequestContext): Promise<AIProviderResponse> {
    const apiKey = process.env.GROQ_API_KEY?.trim() || '';
    if (!apiKey || apiKey.includes('YOUR_API') || apiKey === 'placeholder') {
      return new LocalFallbackAIProvider().generateReply(ctx);
    }

    const systemPrompt = stripDirectPii(buildSystemPrompt(ctx));
    const messages = [
      { role: 'system', content: systemPrompt },
      ...ctx.history.slice(-6).map((m) => ({ role: m.role, content: stripDirectPii(m.text) })),
      { role: 'user', content: stripDirectPii(ctx.message) },
    ];

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages,
          temperature: 0.45,
          max_completion_tokens: 320,
        }),
      });

      if (!response.ok) {
        return new LocalFallbackAIProvider().generateReply(ctx);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return new LocalFallbackAIProvider().generateReply(ctx);
      }

      return { reply: text, source: 'groq', factGrounded: false };
    } catch {
      return new LocalFallbackAIProvider().generateReply(ctx);
    }
  }
}

export class GeminiAIProvider implements AIProvider {
  readonly id = 'gemini' as const;

  async generateReply(ctx: AIRequestContext): Promise<AIProviderResponse> {
    const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
    const privacyConfirmed = process.env.GEMINI_PAID_OR_PRIVATE === 'true';
    if (!apiKey || !privacyConfirmed) {
      return new GroqAIProvider().generateReply(ctx);
    }

    try {
      const prompt = `${stripDirectPii(buildSystemPrompt(ctx))}\n\nUser: ${stripDirectPii(ctx.message)}`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.45, maxOutputTokens: 320 },
          }),
        }
      );
      if (!res.ok) {
        return new LocalFallbackAIProvider().generateReply(ctx);
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        return new LocalFallbackAIProvider().generateReply(ctx);
      }
      return { reply: text, source: 'gemini', factGrounded: false };
    } catch {
      return new LocalFallbackAIProvider().generateReply(ctx);
    }
  }
}

export function resolveAIProvider(): AIProvider {
  const configured = process.env.SMRITI_AI_PROVIDER?.trim().toLowerCase();
  if (configured === 'local') return new LocalFallbackAIProvider();
  if (configured === 'gemini') return new GeminiAIProvider();
  return new GroqAIProvider();
}
