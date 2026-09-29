import type { Comment } from '@/types';
import { triggerDownload } from './utils';

export interface MarkdownComment extends Comment {
  /** Опционально — имя вуза, к которому относится комментарий */
  university_name?: string;
}

/**
 * Экспорт комментариев в Markdown.
 *
 * Формат — совместимый с Confluence/Obsidian:
 *   ## 2026-02-05 14:23 · Иван Петров
 *
 *   Текст комментария
 *
 *   **Вложения:**
 *   - [file.pdf](https://...)
 */
export function commentsToMarkdown(
  comments: MarkdownComment[],
  opts: { title?: string } = {},
): string {
  const lines: string[] = [];

  if (opts.title) {
    lines.push(`# ${opts.title}`, '');
  }

  if (comments.length === 0) {
    lines.push('_Комментариев нет._', '');
    return lines.join('\n');
  }

  // Сортируем по дате создания
  const sorted = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const c of sorted) {
    const date = new Date(c.created_at);
    const dateStr = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    lines.push(`## ${dateStr} · ${c.author}`);
    if (c.university_name) lines.push(`_Вуз: ${c.university_name}_`);
    lines.push('');

    // Экранируем переносы, сохраняем структуру
    lines.push(c.body.trim());
    lines.push('');

    const attachments = Array.isArray((c as unknown as { attachments?: unknown[] }).attachments)
      ? ((c as unknown as { attachments: { name: string; url: string }[] }).attachments)
      : [];

    if (attachments.length > 0) {
      lines.push('**Вложения:**');
      attachments.forEach((a) => {
        lines.push(`- [${a.name}](${a.url})`);
      });
      lines.push('');
    }

    lines.push('---', '');
  }

  return lines.join('\n');
}

/** Скачать Markdown-файл. */
export function downloadCommentsMarkdown(
  comments: MarkdownComment[],
  filename: string,
  opts: { title?: string } = {},
): void {
  const md = commentsToMarkdown(comments, opts);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, filename.endsWith('.md') ? filename : `${filename}.md`);
}

/** Копировать в буфер обмена. */
export async function copyCommentsMarkdown(
  comments: MarkdownComment[],
  opts: { title?: string } = {},
): Promise<void> {
  const md = commentsToMarkdown(comments, opts);
  await navigator.clipboard.writeText(md);
}