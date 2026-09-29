import { useCallback, useEffect, useState } from 'react';
import type { CustomField, CustomFieldValue } from '@/types';
import { listCustomFields, getValuesForEntities } from '@/lib/customFields';

/**
 * Загрузка кастомных полей (определений).
 * Реиспользуется во всех формах, где есть кастомные поля.
 */
export function useCustomFields(entity = 'universities') {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCustomFields(entity);
      setFields(list);
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { fields, loading, reload };
}

/**
 * Батч-загрузка значений для списка сущностей.
 * Возвращает map: entityId → { fieldId → value }
 */
export function useCustomFieldValues(entityIds: string[]) {
  const [values, setValues] = useState<Record<string, Record<string, CustomFieldValue>>>({});
  const key = entityIds.join(',');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const map = await getValuesForEntities(entityIds);
      if (!cancelled) setValues(map);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return values;
}