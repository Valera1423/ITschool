import type { ReactNode } from 'react';

/**
 * Мини-рендер Markdown без внешних зависимостей.
 *
 * Поддерживает:
 * - Заголовки # ## ###
 * - Списки - и 1.
 * - **bold**, `code`, *italic*
 * - Цитаты >
 * - Картинки ![alt](url)
 *
 * Не поддерживает таблицы, вложенные списки.
 * Достаточно для базы знаний.
 */
export function ArticleContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={blocks.length}
        className={`my-2 space-y-1 ${listOrdered ? 'list-decimal' : 'list-disc'} pl-6 text-slate-700 dark:text-slate-300`}
      >
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>,
    );
    listBuffer = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Списки
    if (trimmed.startsWith('- ')) {
      if (listOrdered) flushList();
      listOrdered = false;
      listBuffer.push(trimmed.slice(2));
      return;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      if (!listOrdered) flushList();
      listOrdered = true;
      listBuffer.push(trimmed.replace(/^\d+\.\s/, ''));
      return;
    }

    flushList();

    // Заголовки
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={blocks.length} className="text-base font-semibold text-slate-800 dark:text-slate-100 mt-4 mb-1">
          {renderInline(trimmed.slice(4))}
        </h3>,
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={blocks.length} className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-6 mb-2">
          {renderInline(trimmed.slice(3))}
        </h2>,
      );
    } else if (trimmed.startsWith('# ')) {
      blocks.push(
        <h1 key={blocks.length} className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-6 mb-3">
          {renderInline(trimmed.slice(2))}
        </h1>,
      );
    } else if (trimmed.startsWith('> ')) {
      blocks.push(
        <blockquote key={blocks.length} className="border-l-4 border-sky-400 pl-3 py-1 my-2 text-slate-600 dark:text-slate-300 italic">
          {renderInline(trimmed.slice(2))}
        </blockquote>,
      );
    } else if (trimmed === '') {
      // Пустая строка — пропускаем
    } else {
      blocks.push(
        <p key={blocks.length} className="text-slate-700 dark:text-slate-300 my-2 leading-relaxed">
          {renderInline(trimmed)}
        </p>,
      );
    }
  });

  flushList();

  return <div className="prose-crm">{blocks}</div>;
}

/**
 * Обработка inline-разметки: `code`, **bold**, *italic*, ![img](url).
 */
function renderInline(text: string): ReactNode {
  // 1. Сначала картинки ![alt](url) — они не должны интерпретироваться дальше
  const imgParts = text.split(/(!\[[^\]]*\]\([^)]+\))/g);

  return (
    <>
      {imgParts.map((part, i) => {
        const imgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imgMatch) {
          return (
            <img
              key={i}
              src={imgMatch[2]}
              alt={imgMatch[1]}
              className="rounded-xl my-3 max-w-full border border-slate-200 dark:border-slate-700"
            />
          );
        }

        // 2. Инлайн-код
        const codeParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {codeParts.map((cp, j) => {
              if (cp.startsWith('`') && cp.endsWith('`')) {
                return (
                  <code key={j} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-sky-700 dark:text-sky-300">
                    {cp.slice(1, -1)}
                  </code>
                );
              }

              // 3. bold
              const boldParts = cp.split(/(\*\*[^*]+\*\*)/g);
              return (
                <span key={j}>
                  {boldParts.map((bp, k) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                      return (
                        <strong key={k} className="font-semibold text-slate-900 dark:text-slate-100">
                          {bp.slice(2, -2)}
                        </strong>
                      );
                    }
                    return <span key={k}>{bp}</span>;
                  })}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}