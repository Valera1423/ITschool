// backend/src/constants/workflow-templates.ts
/**
 * Готовые шаблоны workflow.
 *
 * Базовый — 14 шагов из ТЗ п.2. Остальные — «короткий цикл»
 * и «работа с лицензией» (частые сценарии ИТ Школы РТК).
 *
 * Используется в POST /workflows/from-template.
 */

export interface WorkflowTemplateStep {
  title: string;
  /** Код статуса из workflow_status_catalog; 'pending' по умолчанию. */
  statusCode?: string;
}

export interface WorkflowTemplate {
  key: string;
  name: string;
  description: string;
  steps: WorkflowTemplateStep[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'full-14',
    name: 'Полный цикл взаимодействия с вузом',
    description:
      'Базовый workflow из 14 шагов по ТЗ п.2: от поиска контактов до контроля исполнения.',
    steps: [
      { title: 'Поиск контактов ответственного в вузе' },
      { title: 'Коммуникация и уточнение актуальности программ' },
      { title: 'Организация встречи с представителями вуза' },
      { title: 'Обмен пакетом документов' },
      { title: 'Корректировка документов перед подписанием' },
      { title: 'Подписание документов' },
      { title: 'Передача обучающих материалов и лицензии' },
      { title: 'Сопровождение внедрения ИТ-продуктов' },
      { title: 'Обучение преподавателей' },
      { title: 'Актуализация учебной программы' },
      { title: 'Ведение занятий' },
      { title: 'Актуализация документации по продукту' },
      { title: 'Повышение квалификации преподавателей' },
      { title: 'Контроль за исполнением каждого этапа' },
    ],
  },
  {
    key: 'short',
    name: 'Короткий цикл',
    description:
      'Быстрый сценарий: контакт → встреча → документы → запуск.',
    steps: [
      { title: 'Найти контактное лицо' },
      { title: 'Связаться и обсудить программу' },
      { title: 'Организовать встречу' },
      { title: 'Согласовать документы' },
      { title: 'Запустить обучение' },
    ],
  },
  {
    key: 'license',
    name: 'Работа с лицензией',
    description:
      'Процесс подписания и продления лицензии ИТ-продукта.',
    steps: [
      { title: 'Согласовать перечень продуктов' },
      { title: 'Запросить коммерческое предложение' },
      { title: 'Согласовать бюджет' },
      { title: 'Подготовить договор' },
      { title: 'Подписать договор' },
      { title: 'Передать лицензионный ключ' },
      { title: 'Проверить активацию' },
    ],
  },
];

export function findTemplate(key: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.key === key);
}