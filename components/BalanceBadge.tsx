/**
 * BalanceBadge — displays a net balance with colour that reflects its sign.
 *
 * Single Responsibility: knows only about "positive = good, negative = bad"
 * colour logic. It does not decide whether a balance is settled or not —
 * that decision is made by the caller.
 *
 * Open/Closed: new display variants (e.g. compact, large) can be added via
 * the `size` prop without modifying the core colour logic.
 *
 * Interface Segregation: callers pass only `amount`. The optional `size`
 * prop is the only extension point needed so far.
 */

import { StyleSheet, Text } from 'react-native';
import { COLORS } from '../lib/theme';
import { formatCurrencySigned } from '../lib/formatting';

interface BalanceBadgeProps {
  amount: number;
  /** 'md' (default) or 'lg' for hero cards. */
  size?: 'md' | 'lg';
}

export function BalanceBadge({ amount, size = 'md' }: BalanceBadgeProps) {
  const color = amount > 0 ? COLORS.success : amount < 0 ? COLORS.danger : COLORS.text3;
  const style = size === 'lg' ? styles.textLg : styles.textMd;
  return (
    <Text style={[style, { color }]} numberOfLines={1}>
      {formatCurrencySigned(amount)}
    </Text>
  );
}

const styles = StyleSheet.create({
  textMd: { fontSize: 16, fontWeight: '700' },
  textLg: { fontSize: 26, fontWeight: '800' },
});
