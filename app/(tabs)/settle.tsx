import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../../lib/theme';
import { MOCK_USER_NAME } from '../../lib/constants';
import { formatCurrency, formatCurrencySigned } from '../../lib/formatting';
import { openUPIPayment, sendPaymentReminder } from '../../lib/upi';
import { AvatarCircle } from '../../components/AvatarCircle';
import { ScreenState } from '../../components/ScreenState';
import { useSettleTab, type GroupWithDebts } from '../../hooks/useSettleTab';
import type { Debt } from '../../lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────
// (formatting and UPI actions live in lib/formatting.ts and lib/upi.ts)

// ── Debt row ─────────────────────────────────────────────────────────────────

interface DebtRowProps {
  debt: Debt;
  groupId: string;
  groupName: string;
  currentUser: string;
  settlingKey: string | null;
  onSettle: (groupId: string, debt: Debt) => void;
}


function DebtRow({ debt, groupId, groupName, currentUser, settlingKey, onSettle }: DebtRowProps) {
  const key = `${groupId}|${debt.from_person}|${debt.to_person}`;
  const isSettling = settlingKey === key;

  // Contextual action: "Pay via UPI" if current user owes, "Remind" if current user is owed
  const iYOwe    = debt.from_person === currentUser;
  const iAmOwed  = debt.to_person   === currentUser;

  return (
    <View style={debtStyles.row}>
      {/* Line 1: avatars + name (flex) + amount */}
      <View style={debtStyles.topLine}>
        <View style={debtStyles.avatarGroup}>
          <AvatarCircle name={debt.from_person} size={34} bg="#FEE2E2" fg={COLORS.danger} />
          <View style={debtStyles.arrowWrap}>
            <View style={debtStyles.arrowLine} />
            <View style={debtStyles.arrowHead} />
          </View>
          <AvatarCircle name={debt.to_person} size={34} bg="#DCFCE7" fg={COLORS.success} />
        </View>

        <Text style={debtStyles.names} numberOfLines={1}>
          {debt.from_person} → {debt.to_person}
        </Text>
        <Text style={debtStyles.amount}>{formatCurrency(debt.amount)}</Text>
      </View>

      {/* Line 2: action buttons — right-aligned, wraps on narrow screens */}
      <View style={debtStyles.actions}>
        {iYOwe && (
          <TouchableOpacity
            style={debtStyles.upiBtn}
            onPress={() => openUPIPayment(debt.to_person, debt.amount, groupName)}
            activeOpacity={0.75}
          >
            <Text style={debtStyles.upiBtnText}>Pay via UPI 💸</Text>
          </TouchableOpacity>
        )}
        {iAmOwed && (
          <TouchableOpacity
            style={debtStyles.remindBtn}
            onPress={() => sendPaymentReminder(debt.from_person, debt.amount, groupName)}
            activeOpacity={0.75}
          >
            <Text style={debtStyles.remindBtnText}>Remind 🔔</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[debtStyles.settleBtn, isSettling && debtStyles.settleBtnDisabled]}
          onPress={() => onSettle(groupId, debt)}
          disabled={isSettling || settlingKey !== null}
          activeOpacity={0.75}
        >
          {isSettling ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={debtStyles.settleBtnText}>Mark Settled</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────

interface GroupCardProps {
  item: GroupWithDebts;
  expanded: boolean;
  onToggle: () => void;
  settlingKey: string | null;
  currentUser: string;
  onSettle: (groupId: string, debt: Debt) => void;
}

function GroupSettleCard({ item, expanded, onToggle, settlingKey, currentUser, onSettle }: GroupCardProps) {
  const { group, debts } = item;

  // Net balance for current user is already on group.net_balance
  const net = group.net_balance;
  const hasDebts = debts.length > 0;

  return (
    <View style={cardStyles.card}>
      <TouchableOpacity
        style={cardStyles.header}
        onPress={onToggle}
        activeOpacity={0.7}
        disabled={group.is_settled || !hasDebts}
      >
        {/* Emoji bubble */}
        <View style={[cardStyles.emojiCircle, { backgroundColor: group.color }]}>
          <Text style={cardStyles.emoji}>{group.emoji}</Text>
        </View>

        {/* Name + badge */}
        <View style={cardStyles.titleArea}>
          <Text style={cardStyles.groupName} numberOfLines={1}>{group.name}</Text>
          {group.is_settled ? (
            <View style={[cardStyles.badge, cardStyles.badgeSettled]}>
              <Text style={[cardStyles.badgeText, cardStyles.badgeTextSettled]}>Settled ✓</Text>
            </View>
          ) : net !== 0 ? (
            <View style={[cardStyles.badge, net > 0 ? cardStyles.badgeSuccess : cardStyles.badgeDanger]}>
              <Text style={[cardStyles.badgeText, net > 0 ? cardStyles.badgeTextSuccess : cardStyles.badgeTextDanger]}>
                {formatCurrencySigned(net)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Chevron */}
        {!group.is_settled && hasDebts && (
          <Text style={[cardStyles.chevron, expanded && cardStyles.chevronOpen]}>›</Text>
        )}
      </TouchableOpacity>

      {expanded && !group.is_settled && hasDebts && (
        <View style={cardStyles.debtsSection}>
          <View style={cardStyles.divider} />
          {debts.map((debt) => (
            <DebtRow
              key={`${debt.from_person}-${debt.to_person}`}
              debt={debt}
              groupId={group.id}
              groupName={group.name}
              currentUser={currentUser}
              settlingKey={settlingKey}
              onSettle={onSettle}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SettleScreen() {
  const { items, loading, error, settlingKey, settle, reload } = useSettleTab();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Hero totals across all groups for the mock user
  const totalYouOwe = items.reduce((sum, { debts }) => {
    return sum + debts
      .filter(d => d.from_person === MOCK_USER_NAME)
      .reduce((s, d) => s + d.amount, 0);
  }, 0);

  const totalOwedToYou = items.reduce((sum, { debts }) => {
    return sum + debts
      .filter(d => d.to_person === MOCK_USER_NAME)
      .reduce((s, d) => s + d.amount, 0);
  }, 0);

  const net = totalOwedToYou - totalYouOwe;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Who Owes Whom</Text>
        <Text style={styles.headerSub}>Settle up group by group</Text>

        {/* Hero summary card */}
        <View style={[styles.summaryCard, { borderLeftColor: net >= 0 ? COLORS.success : COLORS.danger }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>You owe</Text>
              <Text style={[styles.summaryAmount, styles.colorDanger]}>
                {formatCurrency(totalYouOwe)}
              </Text>
            </View>
            <View style={styles.summarySep} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Owed to you</Text>
              <Text style={[styles.summaryAmount, styles.colorSuccess]}>
                {formatCurrency(totalOwedToYou)}
              </Text>
            </View>
          </View>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net balance  </Text>
            <Text style={[styles.netAmount, net >= 0 ? styles.colorSuccess : styles.colorDanger]}>
              {formatCurrencySigned(net)}
            </Text>
          </View>
        </View>

        {/* Group list */}
        {loading ? (
          <ScreenState variant="loading" message="Loading balances…" />
        ) : error ? (
          <ScreenState variant="error" message={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <ScreenState variant="empty" emoji="🎉" title="All clear!" message="Create a group and add expenses to get started." />
        ) : (
          items.map((item) => (
            <GroupSettleCard
              key={item.group.id}
              item={item}
              expanded={expandedIds.has(item.group.id)}
              onToggle={() => toggleExpand(item.group.id)}
              settlingKey={settlingKey}
              currentUser={MOCK_USER_NAME}
              onSettle={settle}
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text1, marginBottom: 4 },
  headerSub:   { fontSize: 14, color: COLORS.text2, marginBottom: 24 },

  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    ...SHADOW.card,
  },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  summaryItem:   { alignItems: 'center', flex: 1 },
  summaryLabel:  { fontSize: 13, color: COLORS.text2, marginBottom: 4 },
  summaryAmount: { fontSize: 24, fontWeight: '800' },
  summarySep:    { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  netRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  netLabel:  { fontSize: 14, color: COLORS.text2, fontWeight: '500' },
  netAmount: { fontSize: 18, fontWeight: '800' },

  colorSuccess: { color: COLORS.success },
  colorDanger:  { color: COLORS.danger  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  titleArea: { flex: 1, gap: 4 },
  groupName: { fontSize: 15, fontWeight: '700', color: COLORS.text1 },

  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeSuccess: { backgroundColor: '#DCFCE7' },
  badgeDanger:  { backgroundColor: '#FEE2E2' },
  badgeSettled: { backgroundColor: COLORS.border },
  badgeText:    { fontSize: 12, fontWeight: '600' },
  badgeTextSuccess: { color: COLORS.success },
  badgeTextDanger:  { color: COLORS.danger },
  badgeTextSettled: { color: COLORS.text3 },

  chevron:     { fontSize: 22, color: COLORS.border, transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },

  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  debtsSection: { paddingBottom: 8 },
});

const debtStyles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },

  // Line 1: [avatarGroup] [names flex:1] [amount]
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Fixed-width pill containing from-avatar + arrow + to-avatar
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  arrowLine: { width: 12, height: 2, backgroundColor: COLORS.border },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: COLORS.border,
  },

  // names expands to fill available space, pushing amount to the right
  names:  { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text1 },
  amount: { fontSize: 14, fontWeight: '700', color: COLORS.text1 },

  // Line 2: buttons flush-right, wrap to next line if they don't fit
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },

  upiBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  upiBtnText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },

  remindBtn: {
    backgroundColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  remindBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.text2 },

  settleBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  settleBtnDisabled: { opacity: 0.5 },
  settleBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
});
