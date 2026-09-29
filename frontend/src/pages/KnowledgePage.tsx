// frontend/src/pages/KnowledgePage.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Pencil,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Pin,
  Eye,
  ArrowLeft,
  Rocket,
  Building2,
  CheckSquare,
  BarChart3,
  Plug,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { KbArticle, KbCategory } from '@/types';
import {
  listArticles,
  listCategories,
  searchArticles,
  upsertArticle,
  deleteArticle,
  submitFeedback,
  incrementViews,
  categoryColor,
} from '@/lib/knowledge';
import { useAuth } from '@/contexts/AuthContext';
import {
  EmptyState,
  SimpleModal,
  Button,
  Field,
  StatusBadge,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui';
import { ArticleContent } from '@/components/kb/ArticleContent';
import { KbChatWidget } from '@/components/kb/KbChatWidget';
import { asArray, formatDateTime } from '@/lib/utils';

/**
 * База знаний — встроенная документация.
 *
 * Дополнительно: кнопка «Спросить AI» — открывает чат по базе
 * (`KbChatWidget`). Ассистент ищет ответы по статьям, а при клике
 * на найденную статью — открывает её в текущей странице.
 */
const ICONS: Record<string, LucideIcon> = {
  Rocket,
  Building2,
  CheckSquare,
  BarChart3,
  Plug,
  BookOpen,
};

interface Props {
  currentRole: string;
  onNotice: (msg: string) => void;
}

export function KnowledgePage({ currentRole, onNotice }: Props) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<KbArticle | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<KbArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  const canEdit = currentRole === 'admin' || currentRole === 'manager';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([
        listCategories(),
        query.trim().length >= 2
          ? searchArticles(query)
          : listArticles(selectedCategory),
      ]);
      setCategories(asArray(c));
      setArticles(asArray(a));
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [c, a] = await Promise.all([
          listCategories(),
          query.trim().length >= 2
            ? searchArticles(query)
            : listArticles(selectedCategory),
        ]);
        if (cancelled) return;
        setCategories(asArray(c));
        setArticles(asArray(a));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, query]);

  const openArticle = async (a: KbArticle) => {
    setSelected(a);
    void incrementViews(a.id);
  };

  const handleDelete = async (a: KbArticle) => {
    if (!window.confirm(`Удалить статью «${a.title}»?`)) return;
    const err = await deleteArticle(a.id);
    onNotice(err ? `Ошибка: ${err}` : 'Статья удалена.');
    if (!err) {
      setSelected(null);
      await load();
    }
  };

  const grouped = useMemo(() => {
    if (selectedCategory || query.trim().length >= 2) return null;
    const map: Record<string, KbArticle[]> = {};
    articles.forEach((a) => {
      const key = a.category_id ?? 'none';
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [articles, selectedCategory, query]);

  if (selected) {
    return (
      <ArticleView
        article={selected}
        canEdit={canEdit}
        userId={user?.profileId ?? null}
        onBack={() => setSelected(null)}
        onEdit={() => {
          setEditing(selected);
          setEditorOpen(true);
        }}
        onDelete={() => void handleDelete(selected)}
        onNotice={onNotice}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Инструкции и FAQ</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            База знаний
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ответы на вопросы о работе с CRM.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setChatOpen(true)}>
            <Sparkles size={16} /> Спросить AI
          </Button>
          {canEdit && (
            <Button
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus size={18} />
              Новая статья
            </Button>
          )}
        </div>
      </section>

      <div className="relative">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по базе знаний…"
          className={`${inputClass} pl-10`}
        />
      </div>

      {!query && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedCategory
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Все ({articles.length})
          </button>
          {categories.map((c) => {
            const Icon = ICONS[c.icon] ?? BookOpen;
            const col = categoryColor(c.color);
            const count = articles.filter((a) => a.category_id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === c.id
                    ? `${col.bg} ${col.text} ring-1 ring-current`
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <Icon size={14} />
                {c.name}
                {count > 0 && <span className="opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>
      ) : articles.length === 0 ? (
        <EmptyState
          text={query ? 'Ничего не найдено' : 'Статей пока нет'}
          hint={canEdit && !query ? 'Создайте первую статью' : undefined}
          actionLabel={canEdit && !query ? 'Создать статью' : undefined}
          onAction={
            canEdit && !query
              ? () => {
                  setEditing(null);
                  setEditorOpen(true);
                }
              : undefined
          }
          icon={BookOpen}
        />
      ) : (
        <div className="space-y-6">
          {query && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Найдено: {articles.length}
            </p>
          )}

          {grouped ? (
            Object.entries(grouped).map(([catId, list]) => {
              const cat = categories.find((c) => c.id === catId);
              return (
                <div key={catId}>
                  <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    {cat?.name ?? 'Без категории'}
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map((a) => (
                      <ArticleCard
                        key={a.id}
                        article={a}
                        onOpen={() => void openArticle(a)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  onOpen={() => void openArticle(a)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {editorOpen && (
        <ArticleEditorModal
          article={editing}
          categories={categories}
          userId={user?.profileId ?? null}
          authorName={user?.name ?? 'Пользователь'}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onSaved={load}
          onNotice={onNotice}
        />
      )}

      {chatOpen && (
        <KbChatWidget
          onClose={() => setChatOpen(false)}
          onOpenArticle={(slug) => {
            const a = articles.find((x) => x.slug === slug);
            if (a) void openArticle(a);
            setChatOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ArticleCard({
  article,
  onOpen,
}: {
  article: KbArticle;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="text-left bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <BookOpen size={18} className="text-sky-500 flex-shrink-0" />
        {article.pinned && (
          <Pin size={14} className="text-amber-500 flex-shrink-0" />
        )}
      </div>
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 line-clamp-2">
        {article.title}
      </h3>
      {article.excerpt && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-3">
          {article.excerpt}
        </p>
      )}
      <div className="mt-auto flex items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-slate-50 dark:border-slate-800">
        <span className="flex items-center gap-1">
          <Eye size={11} />
          {article.views}
        </span>
        <span className="flex items-center gap-1">
          <ThumbsUp size={11} />
          {article.helpful_count}
        </span>
        {article.tags.length > 0 && (
          <span className="truncate">#{article.tags[0]}</span>
        )}
      </div>
    </button>
  );
}

function ArticleView({
  article,
  canEdit,
  userId,
  onBack,
  onEdit,
  onDelete,
  onNotice,
}: {
  article: KbArticle;
  canEdit: boolean;
  userId: string | null;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNotice: (msg: string) => void;
}) {
  const [feedbackSent, setFeedbackSent] = useState(false);

  const sendFeedback = async (helpful: boolean) => {
    const err = await submitFeedback(article.id, helpful, userId);
    if (err) return onNotice(`Ошибка: ${err}`);
    setFeedbackSent(true);
    onNotice('Спасибо за отзыв!');
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700"
      >
        <ArrowLeft size={14} /> Назад к базе знаний
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {article.title}
            </h1>
            {article.excerpt && (
              <p className="text-slate-500 dark:text-slate-400">
                {article.excerpt}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 flex-wrap">
              {article.author_name && <span>{article.author_name}</span>}
              <span>· {formatDateTime(article.updated_at)}</span>
              <span>
                · <Eye size={11} className="inline" /> {article.views}
              </span>
              {article.tags.map((t) => (
                <StatusBadge key={t} status={`#${t}`} />
              ))}
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-1">
              <button
                onClick={onEdit}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600"
                aria-label="Редактировать"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={onDelete}
                className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                aria-label="Удалить"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        <ArticleContent content={article.content} />

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
            Помогла статья?
          </p>
          {feedbackSent ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              ✓ Спасибо за отзыв!
            </p>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void sendFeedback(true)}
              >
                <ThumbsUp size={14} /> Да ({article.helpful_count})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void sendFeedback(false)}
              >
                <ThumbsDown size={14} /> Нет ({article.not_helpful_count})
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleEditorModal({
  article,
  categories,
  userId,
  authorName,
  onClose,
  onSaved,
  onNotice,
}: {
  article: KbArticle | null;
  categories: KbCategory[];
  userId: string | null;
  authorName: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [categoryId, setCategoryId] = useState(
    article?.category_id ?? categories[0]?.id ?? '',
  );
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? '');
  const [content, setContent] = useState(article?.content ?? '');
  const [tags, setTags] = useState((article?.tags ?? []).join(', '));
  const [pinned, setPinned] = useState(article?.pinned ?? false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return onNotice('Введите заголовок.');
    setSaving(true);
    const { error } = await upsertArticle({
      id: article?.id,
      category_id: categoryId || null,
      title,
      excerpt,
      content,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      pinned,
      status: 'published',
    });
    setSaving(false);
    if (error) return onNotice(`Ошибка: ${error}`);
    onNotice(article ? 'Статья обновлена.' : 'Статья создана.');
    await onSaved();
    onClose();
  };

  return (
    <SimpleModal
      title={article ? 'Редактировать статью' : 'Новая статья'}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Заголовок" wide>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Категория">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={selectClass}
            >
              <option value="">Без категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Теги (через запятую)">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Краткое описание" wide>
            <input
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Содержимое (Markdown)" wide>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              className={`${textareaClass} font-mono text-xs`}
              placeholder="# Заголовок&#10;&#10;Текст статьи..."
            />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-sky-600"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Закрепить
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Сохранение…' : article ? 'Сохранить' : 'Опубликовать'}
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}