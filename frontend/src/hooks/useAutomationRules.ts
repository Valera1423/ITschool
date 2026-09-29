import { useCallback, useEffect, useState } from 'react';
import type { AutomationRule } from '@/types';
import { listRules } from '@/lib/automation';

/**
 * Загрузка правил автоматизации.
 * Используется в AutomationPage.
 */
export function useAutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await listRules());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rules, loading, reload };
}