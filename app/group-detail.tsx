/**
 * Group Detail Screen
 *
 * Layout (top → bottom):
 *   Header       — back button, group emoji + name, "Add Expense" button
 *   Hero card    — current user's net balance in this group
 *   Transactions — chronological expense list
 *   Debts        — who owes whom (minimum settlement transactions)
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../lib/theme';
import { MOCK_USER_NAME } from '../lib/constants';
import { formatCurrency, formatDate, getAvatarLetter } from '../lib/formatting';
import { calcNetEffect } from '../lib/calculations';
import { useGroupDetail } from '../hooks/useGroupDetail';
import { addGroupMember, toUserMessage } from '../lib/api';
import { AvatarCircle } from '../components/AvatarCircle';
import { ScreenState } from '../components/ScreenState';
import type { Debt, Expense } from '../lib/types';

// ── Local types ──────────────────────────────────────────────────────────────

type ContactEntry = { id: string; name: string; phone?: string };

// ── Sub-components ────────────────────────────────────────────────────────────

function ExpenseRow({ expense, onPress }: { expense: Expense; onPress: () => void }) {
  const netEffect = calcNetEffect(expense.total, expense.paid_by, expense.splits, MOCK_USER_NAME);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={expStyles.row}>
      <View style={expStyles.iconBox}>
        <Text style={expStyles.icon}>💸</Text>
      </View>
      <View style={expStyles.body}>
        <Text style={expStyles.title} numberOfLines={1}>{expense.description}</Text>
        <Text style={expStyles.meta}>
          Paid by {expense.paid_by} · {formatDate(expense.created_at)}
        </Text>
      </View>
      <View style={expStyles.right}>
        <Text style={expStyles.total}>{formatCurrency(expense.total)}</Text>
        {netEffect != null && (
          <Text style={[
            expStyles.myShare,
            { color: netEffect >= 0 ? COLORS.success : COLORS.danger },
          ]}>
            {netEffect >= 0
              ? `+${formatCurrency(netEffect)}`
              : `-${formatCurrency(Math.abs(netEffect))}`}
          </Text>
        )}
        <Text style={expStyles.editHint}>Edit ›</Text>
      </View>
    </TouchableOpacity>
  );
}

function DebtRow({ debt }: { debt: Debt }) {
  const iOwe    = debt.from_person === MOCK_USER_NAME;
  const owedToMe = debt.to_person  === MOCK_USER_NAME;

  const fromLabel = iOwe    ? 'You' : debt.from_person;
  const toLabel   = owedToMe ? 'You' : debt.to_person;

  return (
    <View style={[
      debtStyles.card,
      iOwe     && debtStyles.cardOwe,
      owedToMe && debtStyles.cardOwed,
    ]}>

      {/* FROM person — the one who owes */}
      <View style={debtStyles.person}>
        <AvatarCircle
          name={debt.from_person}
          size={36}
          bg={iOwe ? '#FEE2E2' : COLORS.border}
          fg={iOwe ? COLORS.danger : COLORS.text2}
        />
        <Text style={[debtStyles.personName, iOwe && debtStyles.personNameBold]} numberOfLines={1}>
          {fromLabel}
        </Text>
      </View>

      {/* Directional arrow — line + triangle head */}
      <View style={debtStyles.arrowWrap}>
        <View style={[debtStyles.arrowLine, (iOwe || owedToMe) && debtStyles.arrowLineActive]} />
        <View style={[debtStyles.arrowHead, (iOwe || owedToMe) && debtStyles.arrowHeadActive]} />
      </View>

      {/* TO person — the one being paid */}
      <View style={debtStyles.person}>
        <AvatarCircle
          name={debt.to_person}
          size={36}
          bg={owedToMe ? '#DCFCE7' : COLORS.border}
          fg={owedToMe ? COLORS.success : COLORS.text2}
        />
        <Text style={[debtStyles.personName, owedToMe && debtStyles.personNameBold]} numberOfLines={1}>
          {toLabel}
        </Text>
      </View>

      {/* Amount + context label */}
      <View style={debtStyles.amountBlock}>
        <Text style={[
          debtStyles.amount,
          iOwe     && debtStyles.amountOwe,
          owedToMe && debtStyles.amountOwed,
        ]}>
          {formatCurrency(debt.amount)}
        </Text>
        {iOwe     && <Text style={[debtStyles.context, { color: COLORS.danger  }]}>you owe</Text>}
        {owedToMe && <Text style={[debtStyles.context, { color: COLORS.success }]}>owed to you</Text>}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function GroupDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    emoji: string;
    color: string;
    members: string;
  }>();

  const groupId = params.id ?? '';

  // Members can grow after "Add Member" — start from navigation params.
  const [members, setMembers] = useState<string[]>(
    () => JSON.parse(params.members ?? '[]') as string[],
  );

  // Add-member modal state
  const [showAddMember, setShowAddMember]       = useState(false);
  const [newMemberName, setNewMemberName]       = useState('');
  const [redistributeMode, setRedistributeMode] = useState<'future' | 'all'>('future');
  const [isAddingMember, setIsAddingMember]     = useState(false);
  const [addMemberError, setAddMemberError]     = useState<string | null>(null);

  // Contacts picker state
  const isWeb = Platform.OS === 'web';
  const [contactsView, setContactsView]               = useState(false);
  const [allContacts, setAllContacts]                 = useState<ContactEntry[]>([]);
  const [contactsSearch, setContactsSearch]           = useState('');
  const [contactsPermDenied, setContactsPermDenied]   = useState(false);

  const { expenses, myBalance, debts, isLoading, error, reload } = useGroupDetail(groupId);

  const filteredContacts = contactsSearch.trim()
    ? allContacts.filter(c => c.name.toLowerCase().includes(contactsSearch.toLowerCase()))
    : allContacts;

  const heroColor   = myBalance > 0 ? COLORS.success : myBalance < 0 ? COLORS.danger : COLORS.primary;
  const heroLabel   = myBalance > 0 ? 'You are owed' : myBalance < 0 ? 'You owe' : 'All settled up!';
  const heroAmount  = myBalance !== 0 ? formatAmount(Math.abs(myBalance)) : '';

  function handleAddExpense() {
    router.push({
      pathname: '/expense-add',
      params: {
        groupId: groupId,
        groupName: params.name,
        members: JSON.stringify(members),
      },
    });
  }

  function handleCloseAddMember() {
    setShowAddMember(false);
    setNewMemberName('');
    setRedistributeMode('future');
    setAddMemberError(null);
    setContactsView(false);
    setContactsSearch('');
    setContactsPermDenied(false);
  }

  // DEV NOTE — simulating contacts:
  //   iOS Simulator: Simulator menu → Features → Address Book → Add Default Contacts
  //   Android Emulator: Emulator ⋮ → Phone → Contacts → + (add manually)
  //     or: adb push contacts.vcf /sdcard/Download/ then import in Contacts app
  //   Permission dialog appears on first use — tap Allow.
  async function handleOpenContacts() {
    if (isWeb) return;
    // require() inside the function body keeps expo-contacts out of the web bundle
    const Contacts = require('expo-contacts');
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      setContactsPermDenied(true);
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      sort: Contacts.SortTypes.FirstName,
    });
    const entries: ContactEntry[] = (data as any[])
      .filter(c => c.name?.trim())
      .map(c => ({ id: c.id, name: c.name.trim(), phone: c.phoneNumbers?.[0]?.number }));
    setAllContacts(entries);
    setContactsPermDenied(false);
    setContactsSearch('');
    setContactsView(true);
  }

  function handleSelectContact(entry: ContactEntry) {
    setNewMemberName(entry.name);
    setAddMemberError(null);
    setContactsView(false);
    setContactsSearch('');
  }

  async function handleAddMember() {
    const name = newMemberName.trim();
    if (!name) return;
    if (members.includes(name)) {
      setAddMemberError(`${name} is already in this group`);
      return;
    }
    setIsAddingMember(true);
    setAddMemberError(null);
    try {
      const updated = await addGroupMember(groupId, {
        member: name,
        redistribute_past: redistributeMode === 'all',
      });
      setMembers(updated.members);
      setShowAddMember(false);
      setNewMemberName('');
      setRedistributeMode('future');
      reload(); // refresh balances and debts
    } catch (err) {
      setAddMemberError(toUserMessage(err));
    } finally {
      setIsAddingMember(false);
    }
  }

  function handleEditExpense(expense: Expense) {
    router.push({
      pathname: '/expense-add',
      params: {
        groupId: groupId,
        groupName: params.name,
        members: JSON.stringify(members),
        // Edit-mode params — pre-fill the form
        expenseId:       expense.id,
        initDescription: expense.description,
        initAmount:      String(expense.total),
        initPaidBy:      expense.paid_by,
      },
    });
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={[styles.headerEmojiBubble, { backgroundColor: params.color ?? COLORS.border }]}>
          <Text style={styles.headerEmoji}>{params.emoji}</Text>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>{params.name ?? 'Group'}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddExpense} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : error != null ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero balance card ── */}
          <View style={[styles.heroCard, { backgroundColor: heroColor }]}>
            <View style={styles.heroCircle1} />
            <View style={styles.heroCircle2} />
            <Text style={styles.heroLabel}>{heroLabel}</Text>
            {heroAmount !== '' && (
              <Text style={styles.heroAmount}>{heroAmount}</Text>
            )}
            <Text style={styles.heroSub}>
              {members.length} member{members.length !== 1 ? 's' : ''} · {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* ── Members section ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Members</Text>
              <Text style={styles.sectionCount}>{members.length}</Text>
            </View>
            <View style={[styles.listCard, memberStyles.row]}>
              {members.map(m => (
                <View key={m} style={memberStyles.member}>
                  <View style={memberStyles.avatar}>
                    <Text style={memberStyles.avatarLetter}>{avatarLetter(m)}</Text>
                  </View>
                  <Text style={memberStyles.name} numberOfLines={1}>{m}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={memberStyles.addBtn}
                onPress={() => setShowAddMember(true)}
                activeOpacity={0.7}
              >
                <Text style={memberStyles.addBtnPlus}>+</Text>
                <Text style={memberStyles.addBtnLabel}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Transactions section ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Transactions</Text>
              <Text style={styles.sectionCount}>{expenses.length}</Text>
            </View>

            {expenses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🧾</Text>
                <Text style={styles.emptyTitle}>No expenses yet</Text>
                <Text style={styles.emptySubtitle}>Tap + Add to record the first one</Text>
                <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAddExpense} activeOpacity={0.8}>
                  <Text style={styles.emptyAddBtnText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.listCard}>
                {expenses.map((exp, idx) => (
                  <View key={exp.id}>
                    <ExpenseRow expense={exp} onPress={() => handleEditExpense(exp)} />
                    {idx < expenses.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Debts section ── */}
          {debts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Who Owes Whom</Text>
                <Text style={styles.sectionCount}>{debts.length}</Text>
              </View>
              <View style={styles.listCard}>
                {debts.map((debt, idx) => (
                  <View key={`${debt.from_person}-${debt.to_person}`}>
                    <DebtRow debt={debt} />
                    {idx < debts.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {debts.length === 0 && expenses.length > 0 && (
            <View style={styles.settledBanner}>
              <Text style={styles.settledEmoji}>✅</Text>
              <Text style={styles.settledText}>Everyone is settled up!</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {/* ── Add Member modal ── */}
      <Modal
        visible={showAddMember}
        transparent
        animationType="slide"
        onRequestClose={handleCloseAddMember}
      >
        <KeyboardAvoidingView
          style={modalStyles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={modalStyles.backdrop}
            activeOpacity={1}
            onPress={handleCloseAddMember}
          />
          <View style={modalStyles.sheet}>
            {/* Handle */}
            <View style={modalStyles.handle} />

            {contactsView ? (
              /* ── Contacts picker view ── */
              <>
                <View style={modalStyles.contactsHeader}>
                  <TouchableOpacity onPress={() => { setContactsView(false); setContactsSearch(''); }}>
                    <Text style={modalStyles.contactsBack}>‹ Back</Text>
                  </TouchableOpacity>
                  <Text style={modalStyles.contactsTitle}>Choose a contact</Text>
                </View>

                <TextInput
                  style={modalStyles.contactsSearch}
                  placeholder="Search contacts…"
                  placeholderTextColor={COLORS.text3}
                  value={contactsSearch}
                  onChangeText={setContactsSearch}
                  autoFocus
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                />

                <FlatList
                  data={filteredContacts}
                  keyExtractor={item => item.id}
                  style={modalStyles.contactsList}
                  keyboardShouldPersistTaps="handled"
                  getItemLayout={(_d, i) => ({ length: 60, offset: 60 * i, index: i })}
                  ListEmptyComponent={
                    <Text style={modalStyles.contactsEmpty}>
                      {contactsSearch ? 'No contacts match your search.' : 'No contacts found.'}
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={modalStyles.contactItem}
                      onPress={() => handleSelectContact(item)}
                      activeOpacity={0.7}
                    >
                      <View style={modalStyles.contactAvatar}>
                        <Text style={modalStyles.contactAvatarText}>{avatarLetter(item.name)}</Text>
                      </View>
                      <View style={modalStyles.contactBody}>
                        <Text style={modalStyles.contactName} numberOfLines={1}>{item.name}</Text>
                        {item.phone != null && (
                          <Text style={modalStyles.contactPhone} numberOfLines={1}>{item.phone}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : (
              /* ── Manual input view ── */
              <>
                <Text style={modalStyles.title}>Add Member</Text>

                {/* Name input + "From Contacts" button */}
                <Text style={modalStyles.label}>Member name</Text>
                <View style={modalStyles.inputRow}>
                  <TextInput
                    style={[modalStyles.input, modalStyles.inputFlex]}
                    placeholder="e.g. Priya"
                    placeholderTextColor={COLORS.text3}
                    value={newMemberName}
                    onChangeText={t => { setNewMemberName(t); setAddMemberError(null); }}
                    autoFocus={!contactsView}
                    returnKeyType="done"
                    editable={!isAddingMember}
                  />
                  {!isWeb && (
                    <TouchableOpacity
                      style={modalStyles.contactsBtn}
                      onPress={handleOpenContacts}
                      activeOpacity={0.75}
                    >
                      <Text style={modalStyles.contactsBtnText}>From Contacts</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Web note */}
                {isWeb && (
                  <Text style={modalStyles.webNote}>
                    Contacts aren't available in the browser. Enter the name manually.
                  </Text>
                )}

                {/* Permission denied */}
                {contactsPermDenied && (
                  <Text style={modalStyles.error}>
                    Contacts access was denied. Enable it in Settings and try again.
                  </Text>
                )}

                {/* Mode picker */}
                <Text style={modalStyles.label}>Past expenses</Text>
                <TouchableOpacity
                  style={[modalStyles.option, redistributeMode === 'future' && modalStyles.optionActive]}
                  onPress={() => setRedistributeMode('future')}
                  activeOpacity={0.8}
                >
                  <View style={[modalStyles.radio, redistributeMode === 'future' && modalStyles.radioActive]}>
                    {redistributeMode === 'future' && <View style={modalStyles.radioDot} />}
                  </View>
                  <View style={modalStyles.optionBody}>
                    <Text style={[modalStyles.optionTitle, redistributeMode === 'future' && modalStyles.optionTitleActive]}>
                      Only future expenses
                    </Text>
                    <Text style={modalStyles.optionSub}>Past splits stay exactly as recorded</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.option, redistributeMode === 'all' && modalStyles.optionActive]}
                  onPress={() => setRedistributeMode('all')}
                  activeOpacity={0.8}
                >
                  <View style={[modalStyles.radio, redistributeMode === 'all' && modalStyles.radioActive]}>
                    {redistributeMode === 'all' && <View style={modalStyles.radioDot} />}
                  </View>
                  <View style={modalStyles.optionBody}>
                    <Text style={[modalStyles.optionTitle, redistributeMode === 'all' && modalStyles.optionTitleActive]}>
                      Include in all past expenses
                    </Text>
                    <Text style={modalStyles.optionSub}>
                      Every past expense splits equally with {newMemberName || 'new member'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* API error */}
                {addMemberError != null && (
                  <Text style={modalStyles.error}>{addMemberError}</Text>
                )}

                {/* CTA */}
                <TouchableOpacity
                  style={[modalStyles.cta, (!newMemberName.trim() || isAddingMember) && modalStyles.ctaDisabled]}
                  onPress={handleAddMember}
                  disabled={!newMemberName.trim() || isAddingMember}
                  activeOpacity={0.8}
                >
                  {isAddingMember
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={modalStyles.ctaText}>Add Member</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    gap: 10, backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.card, alignItems: 'center',
    justifyContent: 'center', ...SHADOW.card,
  },
  backArrow:        { fontSize: 26, color: COLORS.text1, lineHeight: 30, marginTop: -2 },
  headerEmojiBubble:{
    width: 38, height: 38, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  headerEmoji:  { fontSize: 20 },
  headerTitle:  { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.text1 },
  addBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:      { fontSize: 14, color: COLORS.text2 },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorEmoji:     { fontSize: 40 },
  errorText:      { fontSize: 14, color: COLORS.danger, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
  },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  heroCard: {
    borderRadius: RADIUS.xl, padding: 24, marginBottom: 24,
    overflow: 'hidden', ...SHADOW.elevated,
  },
  heroCircle1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)', top: -40, right: -30,
  },
  heroCircle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)', bottom: -20, left: 20,
  },
  heroLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 4 },
  heroAmount: { fontSize: 40, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  heroSub:    { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  section:       { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.text1 },
  sectionCount: {
    backgroundColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    fontSize: 12, fontWeight: '600', color: COLORS.text2,
  },

  listCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOW.card,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },

  emptyCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 32, alignItems: 'center', gap: 6, ...SHADOW.card,
  },
  emptyEmoji:      { fontSize: 40 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: COLORS.text1, marginTop: 4 },
  emptySubtitle:   { fontSize: 13, color: COLORS.text2 },
  emptyAddBtn: {
    marginTop: 12, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm, paddingHorizontal: 24, paddingVertical: 10,
  },
  emptyAddBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  settledBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 20, ...SHADOW.card,
  },
  settledEmoji: { fontSize: 20 },
  settledText:  { fontSize: 14, fontWeight: '600', color: COLORS.success },
});

const expStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  iconBox: {
    width: 42, height: 42, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
  },
  icon:    { fontSize: 20 },
  body:    { flex: 1 },
  title:   { fontSize: 15, fontWeight: '600', color: COLORS.text1, marginBottom: 3 },
  meta:    { fontSize: 12, color: COLORS.text2 },
  right:   { alignItems: 'flex-end' },
  total:    { fontSize: 15, fontWeight: '700', color: COLORS.text1, marginBottom: 2 },
  myShare:  { fontSize: 12, fontWeight: '600' },
  editHint: { fontSize: 11, color: COLORS.text3, marginTop: 4 },
});

const debtStyles = StyleSheet.create({
  // Card container — neutral by default, tinted for current user involvement
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  cardOwe:   { backgroundColor: 'rgba(239,68,68,0.06)'  }, // you owe — red tint
  cardOwed:  { backgroundColor: 'rgba(34,197,94,0.06)'  }, // owed to you — green tint

  // Person column (avatar + name, used for both from/to)
  person: { alignItems: 'center', width: 52 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  avatarNeutral: { backgroundColor: COLORS.border },
  avatarOwe:     { backgroundColor: 'rgba(239,68,68,0.18)' },
  avatarOwed:    { backgroundColor: 'rgba(34,197,94,0.18)'  },
  avatarLetter:  { fontSize: 15, fontWeight: '700', color: COLORS.text1 },
  personName:     { fontSize: 11, color: COLORS.text2, textAlign: 'center' },
  personNameBold: { fontWeight: '700', color: COLORS.text1 },

  // Arrow between the two avatars
  arrowWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  arrowLine: {
    flex: 1, height: 3,
    backgroundColor: COLORS.border,
  },
  arrowLineActive: { backgroundColor: COLORS.text2 },
  // CSS triangle pointing right — zero-size box with coloured left border
  arrowHead: {
    width: 0, height: 0,
    borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 12,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderLeftColor: COLORS.border,
  },
  arrowHeadActive: { borderLeftColor: COLORS.text2 },

  // Amount + context label on the right
  amountBlock: { alignItems: 'flex-end', minWidth: 72 },
  amount:      { fontSize: 16, fontWeight: '700', color: COLORS.text1 },
  amountOwe:   { color: COLORS.danger  },
  amountOwed:  { color: COLORS.success },
  context:     { fontSize: 11, fontWeight: '500', marginTop: 2 },
});

const memberStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  member:       { alignItems: 'center', gap: 4 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  name:         { fontSize: 11, color: COLORS.text2, maxWidth: 52, textAlign: 'center' },
  addBtn: {
    alignItems: 'center', gap: 4,
    width: 44,
  },
  addBtnPlus: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.background,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    textAlign: 'center', lineHeight: 40,
    fontSize: 22, color: COLORS.text3,
    overflow: 'hidden',
  },
  addBtnLabel: { fontSize: 11, color: COLORS.text3 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: 24, paddingBottom: 40,
    gap: 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 20,
  },
  title:  { fontSize: 20, fontWeight: '800', color: COLORS.text1, marginBottom: 20 },
  label:  { fontSize: 13, fontWeight: '600', color: COLORS.text2, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.text1,
    borderWidth: 1.5, borderColor: COLORS.border,
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.background, borderRadius: RADIUS.sm,
    padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  optionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  radioActive: { borderColor: COLORS.primary },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  optionBody:       { flex: 1 },
  optionTitle:      { fontSize: 14, fontWeight: '600', color: COLORS.text1, marginBottom: 2 },
  optionTitleActive:{ color: COLORS.primary },
  optionSub:        { fontSize: 12, color: COLORS.text2, lineHeight: 17 },
  error: {
    fontSize: 13, color: COLORS.danger,
    marginTop: 4, marginBottom: 8,
  },
  cta: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingVertical: 14, alignItems: 'center',
    marginTop: 8,
  },
  ctaDisabled: { backgroundColor: COLORS.border },
  ctaText:     { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Input row — text field + "From Contacts" button side by side
  inputRow:        { flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'center' },
  inputFlex:       { flex: 1, marginBottom: 0 },
  contactsBtn:     { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.primary },
  contactsBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  webNote:         { fontSize: 12, color: COLORS.text3, marginBottom: 12, marginTop: -14 },

  // Contacts picker view
  contactsHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  contactsBack:      { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  contactsTitle:     { fontSize: 16, fontWeight: '700', color: COLORS.text1 },
  contactsSearch:    { backgroundColor: COLORS.background, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: COLORS.text1, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 10 },
  contactsList:      { maxHeight: 280 },
  contactItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  contactAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  contactBody:       { flex: 1 },
  contactName:       { fontSize: 14, fontWeight: '600', color: COLORS.text1 },
  contactPhone:      { fontSize: 12, color: COLORS.text2, marginTop: 2 },
  contactsEmpty:     { textAlign: 'center', color: COLORS.text3, fontSize: 13, marginTop: 20 },
});
