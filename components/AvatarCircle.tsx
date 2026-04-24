/**
 * AvatarCircle — a single-letter avatar in a coloured circle.
 *
 * Single Responsibility: renders exactly one thing — a circular avatar.
 * It knows nothing about groups, expenses, or debts.
 *
 * Interface Segregation: the props interface is minimal. Callers only pass
 * what this component actually uses. Size and colours are optional with
 * sensible defaults so most call sites need only `name`.
 */

import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../lib/theme';
import { getAvatarLetter } from '../lib/formatting';

interface AvatarCircleProps {
  name: string;
  /** Diameter in points. Defaults to 36. */
  size?: number;
  /** Background colour. Defaults to COLORS.primaryLight. */
  bg?: string;
  /** Letter colour. Defaults to COLORS.primary. */
  fg?: string;
}

export function AvatarCircle({
  name,
  size = 36,
  bg   = COLORS.primaryLight,
  fg   = COLORS.primary,
}: AvatarCircleProps) {
  const fontSize = Math.round(size * 0.4);
  const radius   = size / 2;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.letter, { fontSize, color: fg }]}>
        {getAvatarLetter(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '700' },
});
