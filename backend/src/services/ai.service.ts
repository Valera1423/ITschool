// backend/src/services/ai.service.ts
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface KbChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface KbChatResult {
  answer: string;
  sources: { id: string; title: string; slug: string; snippet: string }[];
  tokensUsed?: number;
  latencyMs: number;
}

/**
 * AI-сервис для базы знаний (RAG).
 *
 * Провайдеры:
 * - OpenAI (embedding + chat) — если OPENAI_API_KEY задан
 * - YandexGPT — если YANDEX_API_KEY задан (152-ФЗ: данные в РФ)
 * - GigaChat — если GIGACHAT_KEY задан
 * - Fallback: только поиск (без LLM) — если ни одного ключа нет
 */

export class AiService {
  /**
   * Ответ на вопрос по базе знаний.
   */
  static async answerKbQuestion(
    question: string,
    userId: string | null,
    sessionId: string,
    history: KbChatMessage[] = [],
  ): Promise<KbChatResult> {
    const started = Date.now();

    // 1. Векторизуем вопрос
    const queryEmbedding = await this.embed(question);

    // 2. Ищем топ-5 релевантных статей
    const sources = await this.searchKb(queryEmbedding, 5);

    // 3. Если LLM не настроен — возвращаем статьи
    if (!this.llmConfigured()) {
      return {
        answer:
          sources.length > 0
            ? `Нашёл ${sources.length} статей. Откройте подходящую:`
            : 'По вашему вопросу ничего не найдено в базе знаний. Уточните формулировку или создайте обращение в поддержку.',
        sources,
        latencyMs: Date.now() - started,
      };
    }

    // 4. Формируем промпт с найденным контекстом
    const prompt = this.buildPrompt(question, sources, history);

    // 5. Вызов LLM
    const { answer, tokens } = await this.chat(prompt);

    // 6. Логируем (для аналитики)
    const latency = Date.now() - started;
    await this.logMessages(userId, sessionId, question, answer, sources, tokens, latency);

    return {
      answer,
      sources,
      tokensUsed: tokens,
      latencyMs: latency,
    };
  }

  // ============================================================
  // Embedding
  // ============================================================

  private static async embed(text: string): Promise<number[]> {
    const provider = env.AI_PROVIDER ?? 'openai';

    if (provider === 'openai' && env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000),
        }),
      });
      if (!res.ok) throw new Error(`OpenAI embedding failed: ${res.status}`);
      const data = (await res.json()) as { data: { embedding: number[] }[] };
      return data.data[0].embedding;
    }

    // Fallback: hash-based pseudo-embedding (только для dev-демо)
    logger.warn('AI provider не настроен, использую псевдо-embedding');
    return this.fakeEmbedding(text);
  }

  private static fakeEmbedding(text: string): number[] {
    // НЕ для прода. Даёт детерминированные координаты из хеша строки.
    const vec = new Array(1536).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % 1536] = (vec[i % 1536] + text.charCodeAt(i)) / 2;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  // ============================================================
  // Vector search
  // ============================================================

  private static async searchKb(
    embedding: number[],
    limit: number,
  ): Promise<KbChatResult['sources']> {
    if (!embedding.length) return [];

    const vectorLiteral = `[${embedding.join(',')}]`;

    const rows = await prisma.$queryRaw<
      Array<{ id: string; title: string; slug: string; content: string; distance: number }>
    >`
      SELECT id, title, slug, content,
             1 - (embedding <=> ${vectorLiteral}::vector) AS distance
      FROM kb_articles
      WHERE deleted_at IS NULL
        AND status = 'published'
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      snippet: r.content.slice(0, 300),
    }));
  }

  // ============================================================
  // LLM chat
  // ============================================================

  private static llmConfigured(): boolean {
    return !!(env.OPENAI_API_KEY || env.YANDEX_API_KEY || env.GIGACHAT_KEY);
  }

  private static buildPrompt(
    question: string,
    sources: KbChatResult['sources'],
    history: KbChatMessage[],
  ): string {
    const context = sources
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}`)
      .join('\n\n');

    return `Ты — ассистент CRM ИТ Школы Ростелеком.
Отвечай ТОЛЬКО на основе контекста ниже. Если ответа нет — скажи «не нашёл в документации, обратитесь к администратору».
Формат ответа: краткий (2-4 предложения), на русском, с указанием номеров источников в квадратных скобках.

Контекст:
${context}

${history.length > 0 ? `История диалога:\n${history.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n')}\n` : ''}
Вопрос: ${question}`;
  }

  private static async chat(prompt: string): Promise<{ answer: string; tokens: number }> {
    const provider = env.AI_PROVIDER ?? 'openai';

    if (provider === 'yandex' && env.YANDEX_API_KEY) {
      return this.chatYandex(prompt);
    }
    if (provider === 'gigachat' && env.GIGACHAT_KEY) {
      return this.chatGigaChat(prompt);
    }
    if (env.OPENAI_API_KEY) {
      return this.chatOpenAI(prompt);
    }
    throw new Error('LLM provider не настроен');
  }

  private static async chatOpenAI(prompt: string): Promise<{ answer: string; tokens: number }> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI chat failed: ${res.status}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage: { total_tokens: number };
    };
    return {
      answer: data.choices[0].message.content.trim(),
      tokens: data.usage.total_tokens,
    };
  }

  private static async chatYandex(prompt: string): Promise<{ answer: string; tokens: number }> {
    const res = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${env.YANDEX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelUri: `gpt://${env.YANDEX_FOLDER_ID}/yandexgpt-lite`,
        completionOptions: { temperature: 0.2, maxTokens: '500' },
        messages: [{ role: 'user', text: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`YandexGPT failed: ${res.status}`);
    const data = (await res.json()) as {
      result: { alternatives: { message: { text: string } }[]; usage: { totalTokens: string } };
    };
    return {
      answer: data.result.alternatives[0].message.text.trim(),
      tokens: Number(data.result.usage.totalTokens),
    };
  }

  private static async chatGigaChat(prompt: string): Promise<{ answer: string; tokens: number }> {
    // Упрощённо — в реальности нужен OAuth flow
    throw new Error('GigaChat пока не реализован');
  }

  // ============================================================
  // Логирование
  // ============================================================

  private static async logMessages(
    userId: string | null,
    sessionId: string,
    question: string,
    answer: string,
    sources: KbChatResult['sources'],
    tokens: number,
    latencyMs: number,
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO ai_chat_messages (user_id, session_id, role, content, latency_ms)
        VALUES (${userId}::uuid, ${sessionId}::uuid, 'user', ${question}, NULL)
      `;
      await prisma.$executeRaw`
        INSERT INTO ai_chat_messages (user_id, session_id, role, content, sources, tokens_used, latency_ms)
        VALUES (${userId}::uuid, ${sessionId}::uuid, 'assistant', ${answer}, ${JSON.stringify(sources)}::jsonb, ${tokens}, ${latencyMs})
      `;
    } catch (e) {
      logger.warn({ err: e }, 'AI chat log failed');
    }
  }

  /**
   * Batch-эмбеддинг всех статей KB (для cron при обновлении).
   */
  static async embedAllArticles(): Promise<{ processed: number; failed: number }> {
    const articles = await prisma.kbArticle.findMany({
      where: { deletedAt: null, status: 'published' },
      select: { id: true, title: true, content: true },
    });

    let processed = 0;
    let failed = 0;

    for (const a of articles) {
      try {
        const embedding = await this.embed(`${a.title}\n\n${a.content}`);
        const vectorLiteral = `[${embedding.join(',')}]`;
        await prisma.$executeRaw`
          UPDATE kb_articles SET embedding = ${vectorLiteral}::vector WHERE id = ${a.id}::uuid
        `;
        processed++;
      } catch (e) {
        logger.warn({ err: e, articleId: a.id }, 'Embed failed');
        failed++;
      }
    }

    return { processed, failed };
  }

  // ============================================================
  // Подсказка по следующему шагу workflow
  // ============================================================

  /**
   * Подсказка по следующему шагу workflow.
   *
   * Принимает краткий контекст: имя вуза, текущий шаг, историю
   * переходов. Возвращает:
   *   - suggestedNextStepId — id шага из списка steps (может быть null),
   *   - reasoning — короткое обоснование,
   *   - risks — массив рисков,
   *   - priority — 'low' | 'medium' | 'high'.
   *
   * Работает через существующий AI-провайдер (OpenAI / YandexGPT /
   * GigaChat). Если ни один не настроен — возвращает rule-based
   * фолбэк: следующий шаг по линейному графу + риск «нет касаний N дней».
   */
  static async suggestWorkflowStep(input: {
    universityName: string;
    currentStepTitle: string | null;
    steps: { id: string; title: string }[];
    lastTransitions: { fromStatus: string | null; toStatus: string; comment: string | null; at: string }[];
  }): Promise<{
    suggestedNextStepId: string | null;
    reasoning: string;
    risks: string[];
    priority: 'low' | 'medium' | 'high';
  }> {
    // ─── Rule-based фолбэк (работает всегда, без внешних вызовов)
    const idx = input.currentStepTitle
      ? input.steps.findIndex((s) => s.title === input.currentStepTitle)
      : -1;
    const next = idx >= 0 && idx < input.steps.length - 1 ? input.steps[idx + 1] : null;

    const risks: string[] = [];
    if (input.lastTransitions.length === 0) {
      risks.push('Нет ни одного перехода — вуз ещё не начал движение по workflow');
    } else {
      const last = new Date(input.lastTransitions[0].at).getTime();
      const days = (Date.now() - last) / 86_400_000;
      if (days > 14) {
        risks.push(`Последнее касание было ${Math.floor(days)} дн. назад`);
      }
    }

    const priority: 'low' | 'medium' | 'high' =
      risks.length > 0 ? 'high' : next ? 'medium' : 'low';

    const baseResult = {
      suggestedNextStepId: next?.id ?? null,
      reasoning: next
        ? `Следующий логический шаг — «${next.title}».`
        : 'Workflow завершён или ещё не начат.',
      risks,
      priority,
    };

    // ─── LLM-обогащение (если провайдер настроен)
    // Обёрнуто в try — внешний вызов не должен ломать ответ.
    if (this.llmConfigured()) {
      try {
        const prompt = this.buildWorkflowPrompt(input, baseResult);
        const { answer } = await this.chat(prompt);

        // LLM должна вернуть строгий JSON:
        //   { "suggestedNextStepId": "...", "reasoning": "...",
        //     "risks": ["..."], "priority": "low|medium|high" }
        // Парсим безопасно и валидируем — если что-то не так,
        // возвращаем rule-based результат.
        const parsed = this.tryParseWorkflowSuggestion(answer, input.steps);
        if (parsed) {
          return parsed;
        }
      } catch (e) {
        logger.warn({ err: e }, 'suggestWorkflowStep: LLM enrich failed');
      }
    }

    return baseResult;
  }

  /**
   * Промпт для LLM: подсказка следующего шага workflow.
   *
   * Формат ответа жёстко JSON — его парсит tryParseWorkflowSuggestion.
   */
  private static buildWorkflowPrompt(
    input: {
      universityName: string;
      currentStepTitle: string | null;
      steps: { id: string; title: string }[];
      lastTransitions: { fromStatus: string | null; toStatus: string; comment: string | null; at: string }[];
    },
    fallback: {
      suggestedNextStepId: string | null;
      reasoning: string;
      risks: string[];
      priority: 'low' | 'medium' | 'high';
    },
  ): string {
    const stepsList = input.steps
      .map((s, i) => `  ${i + 1}. id=${s.id} — «${s.title}»`)
      .join('\n');

    const transitionsList = input.lastTransitions.length
      ? input.lastTransitions
          .slice(0, 10)
          .map(
            (t) =>
              `  - ${t.at}: ${t.fromStatus ?? '—'} → ${t.toStatus}` +
              (t.comment ? ` («${t.comment}»)` : ''),
          )
          .join('\n')
      : '  (переходов не было)';

    return `Ты — CRM-ассистент ИТ Школы Ростелеком. Помоги менеджеру решить,
какой следующий шаг workflow выбрать для вуза.

Вуз: ${input.universityName}
Текущий шаг: ${input.currentStepTitle ?? '—'}

Все шаги workflow (в порядке следования):
${stepsList}

Последние переходы:
${transitionsList}

Черновой rule-based ответ (можешь уточнить или подтвердить):
${JSON.stringify(fallback)}

Верни СТРОГО JSON без markdown, без пояснений, без обратных кавычек:
{
  "suggestedNextStepId": "<id из списка шагов или null>",
  "reasoning": "<краткое обоснование на русском, 1-3 предложения>",
  "risks": ["<риск1>", "<риск2>"],
  "priority": "low" | "medium" | "high"
}`;
  }

  /**
   * Парсит ответ LLM и валидирует его.
   * Возвращает null, если ответ невалидный —
   * тогда вызывающий код откатывается на rule-based результат.
   */
  private static tryParseWorkflowSuggestion(
    raw: string,
    steps: { id: string; title: string }[],
  ): {
    suggestedNextStepId: string | null;
    reasoning: string;
    risks: string[];
    priority: 'low' | 'medium' | 'high';
  } | null {
    try {
      // Срезаем возможные ```json ... ``` обёртки
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      // suggestedNextStepId: должен быть либо null, либо id из steps
      const rawId = parsed.suggestedNextStepId;
      let suggestedNextStepId: string | null = null;
      if (typeof rawId === 'string' && steps.some((s) => s.id === rawId)) {
        suggestedNextStepId = rawId;
      } else if (rawId === null) {
        suggestedNextStepId = null;
      } else {
        // LLM вернула id, которого нет в списке — отбраковываем
        return null;
      }

      const reasoning =
        typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0
          ? parsed.reasoning.trim().slice(0, 500)
          : null;
      if (!reasoning) return null;

      const risks = Array.isArray(parsed.risks)
        ? parsed.risks
            .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
            .map((r) => r.trim().slice(0, 300))
            .slice(0, 5)
        : [];

      const rawPriority = parsed.priority;
      const priority: 'low' | 'medium' | 'high' =
        rawPriority === 'low' || rawPriority === 'medium' || rawPriority === 'high'
          ? rawPriority
          : 'medium';

      return { suggestedNextStepId, reasoning, risks, priority };
    } catch {
      return null;
    }
  }
}