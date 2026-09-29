import { useCallback, useEffect, useState } from 'react';
import type { Tag } from '@/types';
import { listTags, getTagsForUniversities } from '@/lib/tags';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setTags(await listTags());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tags, loading, reload };
}

export function useUniversityTags(universityIds: string[]) {
  const [map, setMap] = useState<Record<string, string[]>>({});
  const key = universityIds.join(',');

  const reload = useCallback(async () => {
    if (universityIds.length === 0) {
      setMap({});
      return;
    }
    const m = await getTagsForUniversities(universityIds);
    setMap(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { map, reload };
}