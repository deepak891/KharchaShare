/**
 * Loads all data needed for the group detail screen in parallel.
 *
 * Returns expenses, per-member balances, simplified debts, and a
 * convenience myBalance for the current user.
 *
 * Re-fetches whenever the screen comes into focus (useFocusEffect).
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getGroupExpenses, getGroupBalances, getGroupDebts, toUserMessage } from '../lib/api';
import { MOCK_USER_NAME } from '../lib/constants';
import type { Debt, Expense, MemberBalance } from '../lib/types';

export function useGroupDetail(groupId: string) {
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [balances, setBalances]   = useState<MemberBalance[]>([]);
  const [debts, setDebts]         = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const [newExpenses, newBalances, newDebts] = await Promise.all([
        getGroupExpenses(groupId),
        getGroupBalances(groupId),
        getGroupDebts(groupId),
      ]);
      setExpenses(newExpenses);
      setBalances(newBalances);
      setDebts(newDebts);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, [groupId]));

  /** Current user's net balance: positive = owed to them, negative = they owe. */
  const myBalance = balances.find(b => b.person === MOCK_USER_NAME)?.net ?? 0;

  return { expenses, balances, myBalance, debts, isLoading, error, reload: load };
}
