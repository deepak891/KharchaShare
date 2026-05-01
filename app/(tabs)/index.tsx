import { useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../../lib/theme';
import { MOCK_USER_NAME } from '../../lib/constants';
import { formatCurrency, formatCurrencySigned } from '../../lib/formatting';
import { GroupCard } from '../../components/GroupCard';
import { ScreenState } from '../../components/ScreenState';
import { useGroups } from '../../hooks/useGroups';

export default function GroupsScreen() {
  const router = useRouter();
  const { groups, isLoading, error, reload } = useGroups();

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const netBalance = groups.reduce((sum, g) => sum + g.net_balance, 0);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingName}>Hey {MOCK_USER_NAME}! 👋</Text>
            <Text style={styles.greetingSubtitle}>Here's your kharcha</Text>
          </View>
          <TouchableOpacity style={styles.notifButton}>
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Hero balance card — hidden while loading or on error */}
        {!isLoading && error == null && (
          <View style={styles.heroCard}>
            <View style={styles.heroCircle1} />
            <View style={styles.heroCircle2} />
            <Text style={styles.heroLabel}>Total Balance</Text>
            <Text style={styles.heroAmount}>{formatCurrencySigned(netBalance)}</Text>
            <Text style={styles.heroSubtitle}>
              across {groups.length} group{groups.length !== 1 ? 's' : ''}
            </Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {netBalance >= 0 ? '✓ You are owed money' : '↑ You owe money'}
              </Text>
            </View>
          </View>
        )}

        {/* Section header */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <TouchableOpacity>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        {/* States: loading / error / empty / list */}
        {isLoading ? (
          <ScreenState variant="loading" message="Loading groups…" />
        ) : error != null ? (
          <ScreenState variant="error" message={error} onRetry={reload} />
        ) : groups.length === 0 ? (
          <ScreenState
            variant="empty"
            emoji="🏕️"
            title="No groups yet"
            message="Tap + to create your first group"
          />
        ) : (
          groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              onPress={() => router.push({
                pathname: '/group-detail',
                params: {
                  id: group.id,
                  name: group.name,
                  emoji: group.emoji,
                  color: group.color,
                  members: JSON.stringify(group.members),
                },
              })}
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/group-create')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingName:     { fontSize: 24, fontWeight: '700', color: COLORS.text1 },
  greetingSubtitle: { fontSize: 14, color: COLORS.text2, marginTop: 2 },
  notifButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  notifIcon: { fontSize: 18 },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: 24,
    marginBottom: 28,
    overflow: 'hidden',
    ...SHADOW.elevated,
  },
  heroCircle1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -30,
  },
  heroCircle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -20, left: 20,
  },
  heroLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 6 },
  heroAmount:   { fontSize: 42, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroBadgeText: { fontSize: 12, color: '#FFF', fontWeight: '600' },

  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle:  { fontSize: 18, fontWeight: '700', color: COLORS.text1 },
  sectionAction: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.elevated,
  },
  fabIcon: { fontSize: 30, color: '#FFF', lineHeight: 34, marginTop: -2 },
});
