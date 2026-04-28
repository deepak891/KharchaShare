/**
 * useSettleTab — data hook for the Settle Up tab.
 *
 * Fetches all groups and their outstanding debts in parallel.
 * Exposes a `settle` action that records a manual settlement and
 * refreshes the data automatically.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getGroups, getGroupDebts, settleDebt } from '../lib/api';
import type { Debt, Group } from '../lib/types';

export interface GroupWithDebts {
  group: Group;
  debts: Debt[];
}

interface UseSettleTabResult {
  items: GroupWithDebts[];
  loading: boolean;
  error: string | null;
  /** Key of the debt currently being settled: "groupId|from|to" */
  settlingKey: string | null;
  settle: (groupId: string, debt: Debt) => Promise<void>;
  reload: () => void;
}

export function useSettleTab(): UseSettleTabResult {
  const [items, setItems]           = useState<GroupWithDebts[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await getGroups();
      const results = await Promise.all(
        groups.map(async (group) => {
          try {
            const debts = await getGroupDebts(group.id);
            return { group, debts };
          } catch {
            return { group, debts: [] };
          }
        }),
      );
      setItems(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settle data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const settle = useCallback(
    async (groupId: string, debt: Debt) => {
      const key = `${groupId}|${debt.from_person}|${debt.to_person}`;
      setSettlingKey(key);
      try {
        await settleDebt(groupId, {
          from_person: debt.from_person,
          to_person: debt.to_person,
          amount: debt.amount,
        });
        await load();
      } finally {
        setSettlingKey(null);
      }
    },
    [load],
  );

  return { items, loading, error, settlingKey, settle, reload: load };
}
