/**
 * ExpenseCard — a single row in the AI Splitter tab's history list.
 *
 * NOTE: This component uses its own view-model type (ExpenseCardData) which is
 * intentionally different from the API's Expense type in lib/types.ts.
 * The AI Splitter tab shows a local "parsed" expense before it is saved to a
 * group, so the shape of the data is different (no id, no splits array — just
 * display fields). Keeping this type local makes the distinction explicit.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../lib/theme';

/** View-model for the AI Splitter tab expense list. Not the same as lib/types.ts Expense. */
export interface ExpenseCardData {
  id: string;
  name: string;
  emoji: string;
  emojiBg: string;
  group: string;
  date: string;
  /** Positive = owed to you, negative = you owe. */
  amount: number;
}

interface ExpenseCardProps {
  expense: ExpenseCardData;
  onPress?: () => void;
}

export function ExpenseCard({ expense, onPress }: ExpenseCardProps) {
  const isOwed = expense.amount > 0;
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.emojiCircle, { backgroundColor: expense.emojiBg }]}>
        <Text style={styles.emoji}>{expense.emoji}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{expense.name}</Text>
        <Text style={styles.group}>{expense.group}</Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, isOwed ? styles.colorSuccess : styles.colorDanger]}>
          {isOwed ? '↑' : '↓'} ₹{Math.abs(expense.amount)}
        </Text>
        <Text style={[styles.direction, isOwed ? styles.colorSuccess : styles.colorDanger]}>
          {isOwed ? 'owed to you' : 'you owe'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.card,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji:     { fontSize: 20 },
  info:      { flex: 1 },
  name:      { fontSize: 15, fontWeight: '600', color: COLORS.text1, marginBottom: 3 },
  group:     { fontSize: 12, color: COLORS.text3 },
  right:     { alignItems: 'flex-end' },
  amount:    { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  direction: { fontSize: 11, fontWeight: '500' },

  colorSuccess: { color: COLORS.success },
  colorDanger:  { color: COLORS.danger  },
});
