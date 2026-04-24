/**
 * MemberChip — a selectable pill showing a member's initial and name.
 *
 * Single Responsibility: renders one member chip; manages its own selected
 * state appearance. It does not manage who is selected overall.
 *
 * Interface Segregation: the onSelect callback is optional so the chip
 * can be used in read-only contexts (e.g. a "split preview" list) without
 * passing a no-op handler.
 *
 * Used in: expense-add.tsx (Paid By selector), future group-create refactor.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS } from '../lib/theme';
import { getAvatarLetter } from '../lib/formatting';

interface MemberChipProps {
  name: string;
  /** Display label override — pass "You" when name === currentUser. */
  label?: string;
  selected: boolean;
  onSelect?: () => void;
}

export function MemberChip({ name, label, selected, onSelect }: MemberChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onSelect}
      disabled={onSelect == null}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, selected && styles.avatarSelected]}>
        <Text style={styles.avatarText}>{getAvatarLetter(name)}</Text>
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label ?? name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  chipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: { backgroundColor: COLORS.primary },
  avatarText:     { fontSize: 12, fontWeight: '700', color: '#FFF' },

  label:         { fontSize: 13, fontWeight: '600', color: COLORS.text2 },
  labelSelected: { color: COLORS.primary },
});
