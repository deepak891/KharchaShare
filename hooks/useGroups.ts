import { useCallback, useState } from 'react';
import { getGroups, toUserMessage } from '../lib/api';
import type { Group } from '../lib/types';

interface UseGroupsResult {
  groups: Group[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Fetches all groups from the backend.
 *
 * Usage:
 *   const { groups, isLoading, error, reload } = useGroups();
 *   useFocusEffect(useCallback(() => { reload(); }, [reload]));
 */
export function useGroups(): UseGroupsResult {
  const [groups, setGroups]     = useState<Group[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroups(await getGroups());
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { groups, isLoading, error, reload };
}
