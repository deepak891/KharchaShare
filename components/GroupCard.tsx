import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../lib/theme';
import type { Group } from '../lib/types';

interface GroupCardProps {
  group: Group;
  onPress?: () => void;
}

export function GroupCard({ group, onPress }: GroupCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.emojiCircle, { backgroundColor: group.color }]}>
        <Text style={styles.emoji}>{group.emoji}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{group.name}</Text>
        <Text style={styles.members}>
          {group.members.length} member{group.members.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.right}>
        {group.is_settled ? (
          <Text style={[styles.balance, styles.colorNeutral]}>Settled ✓</Text>
        ) : group.net_balance !== 0 ? (
          <Text style={[styles.balance, group.net_balance > 0 ? styles.colorSuccess : styles.colorDanger]}>
            {group.net_balance > 0 ? '+₹' : '-₹'}{Math.abs(group.net_balance).toLocaleString('en-IN')}
          </Text>
        ) : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.card,
  },
  emojiCircle: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  emoji:   { fontSize: 22 },
  info:    { flex: 1 },
  name:    { fontSize: 16, fontWeight: '600', color: COLORS.text1, marginBottom: 3 },
  members: { fontSize: 13, color: COLORS.text2 },
  right:   { alignItems: 'flex-end' },
  balance: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  chevron: { fontSize: 22, color: COLORS.border, lineHeight: 24 },

  colorSuccess: { color: COLORS.success },
  colorDanger:  { color: COLORS.danger  },
  colorNeutral: { color: COLORS.text3   },
});
