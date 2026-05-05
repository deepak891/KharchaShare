/**
 * AI Expense Splitter tab
 *
 * Purpose: type any expense in plain English → AI returns a structured split.
 *
 * Layout:
 *   Top    — title + subtitle
 *   Middle — example prompts (idle) or parse result card (after submit)
 *   Bottom — fixed AI input bar + send / mic buttons
 */

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW } from "../../lib/theme";
import { GROUP_PARTICIPANTS } from "../../lib/constants";
import { ParseResultModal } from "../../components/ParseResultModal";
import { useExpenseParsing } from "../../hooks/useExpenseParsing";
import { useState } from "react";

// ── Example prompts ───────────────────────────────────────────────────────────

const EXAMPLES = [
  { emoji: "🍕", text: "Pizza ₹1200, split equally among 3 of us" },
  { emoji: "✈️", text: "Flight tickets ₹18000, I paid for Raj and Priya" },
  { emoji: "🍺", text: "Dinner ₹3200, Raj no drinks, split accordingly" },
  {
    emoji: "🏨",
    text: "Hotel ₹5400, Deepak and Jitu stayed, Saurav left early",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const [aiText, setAiText] = useState("");
  const { parsedResult, isParsing, error, submit, clear } = useExpenseParsing();

  async function handleSubmit() {
    const trimmed = aiText.trim();
    if (!trimmed) return;
    await submit(trimmed, [...GROUP_PARTICIPANTS]);
  }

  function handleAddExpense() {
    Alert.alert("Added! 🎉", `"${parsedResult?.description}" has been added.`);
    clear();
    setAiText("");
  }

  function useExample(text: string) {
    setAiText(text);
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Splitter</Text>
          <Text style={styles.headerSub}>
            Describe any expense in plain English — AI will figure out the
            split.
          </Text>
        </View>

        {/* ── Middle content (examples or result) ── */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isParsing ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Analysing your expense…</Text>
              <Text style={styles.loadingSubText}>
                The AI is figuring out who owes what
              </Text>
            </View>
          ) : error != null ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorTitle}>Couldn't parse that</Text>
              <Text style={styles.errorBody}>{error}</Text>
            </View>
          ) : parsedResult == null ? (
            <>
              {/* How it works */}
              <View style={styles.howCard}>
                <Text style={styles.howTitle}>How it works</Text>
                <View style={styles.howSteps}>
                  <View style={styles.howStep}>
                    <Text style={styles.howStepNum}>1</Text>
                    <Text style={styles.howStepText}>
                      Type the expense in plain English below
                    </Text>
                  </View>
                  <View style={styles.howStep}>
                    <Text style={styles.howStepNum}>2</Text>
                    <Text style={styles.howStepText}>
                      AI reads the context and splits fairly
                    </Text>
                  </View>
                  <View style={styles.howStep}>
                    <Text style={styles.howStepNum}>3</Text>
                    <Text style={styles.howStepText}>
                      Review and add it to your group
                    </Text>
                  </View>
                </View>
              </View>

              {/* Example prompts */}
              <Text style={styles.examplesLabel}>Try an example</Text>
              {EXAMPLES.map((ex, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.exampleChip}
                  onPress={() => useExample(ex.text)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.exampleEmoji}>{ex.emoji}</Text>
                  <Text style={styles.exampleText}>{ex.text}</Text>
                  <Text style={styles.exampleArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Fixed input bar at bottom ── */}
        <View style={styles.inputContainer}>
          <View style={styles.inputBar}>
            <Text style={styles.sparkle}>✨</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Dinner ₹3200, Raj no drinks…"
              placeholderTextColor={COLORS.text3}
              value={aiText}
              onChangeText={setAiText}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
              editable={!isParsing}
              multiline={false}
            />
            {isParsing ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={styles.iconBtn}
              />
            ) : (
              <TouchableOpacity
                onPress={handleSubmit}
                style={[
                  styles.iconBtn,
                  styles.sendBtn,
                  !aiText.trim() && styles.sendBtnOff,
                ]}
                disabled={!aiText.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.sendIcon}>➤</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.iconBtn, styles.micBtn]}
              activeOpacity={0.7}
              onPress={() =>
                Alert.alert(
                  "Coming Soon 🎤",
                  "Voice input will use Ollama audio capabilities.\nStay tuned!",
                )
              }
            >
              <Text style={styles.micIcon}>🎤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Parse result modal ── */}
      {parsedResult != null && (
        <ParseResultModal
          result={parsedResult}
          onClose={clear}
          onAdd={handleAddExpense}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text1,
    marginBottom: 4,
  },
  headerSub: { fontSize: 14, color: COLORS.text2, lineHeight: 20 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  // Loading state
  loadingCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 40,
    alignItems: "center",
    gap: 12,
    ...SHADOW.card,
    marginTop: 8,
  },
  loadingText: { fontSize: 16, fontWeight: "700", color: COLORS.text1 },
  loadingSubText: { fontSize: 13, color: COLORS.text2, textAlign: "center" },

  // Error state
  errorCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 32,
    alignItems: "center",
    gap: 8,
    ...SHADOW.card,
    marginTop: 8,
  },
  errorEmoji: { fontSize: 36 },
  errorTitle: { fontSize: 16, fontWeight: "700", color: COLORS.danger },
  errorBody: {
    fontSize: 13,
    color: COLORS.text2,
    textAlign: "center",
    lineHeight: 20,
  },

  // How it works card
  howCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 24,
    ...SHADOW.card,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text1,
    marginBottom: 14,
  },
  howSteps: { gap: 12 },
  howStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  howStepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    textAlign: "center",
    lineHeight: 26,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  howStepText: { fontSize: 13, color: COLORS.text2, flex: 1 },

  // Example prompts
  examplesLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  exampleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    ...SHADOW.card,
  },
  exampleEmoji: { fontSize: 20 },
  exampleText: { flex: 1, fontSize: 13, color: COLORS.text1, lineHeight: 18 },
  exampleArrow: { fontSize: 18, color: COLORS.text3 },

  // Fixed bottom input
  inputContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
    ...SHADOW.card,
  },
  sparkle: { fontSize: 16 },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text1,
    paddingVertical: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: { backgroundColor: COLORS.primary },
  sendBtnOff: { backgroundColor: COLORS.border },
  sendIcon: { fontSize: 14, color: "#FFF" },
  micBtn: { backgroundColor: COLORS.background },
  micIcon: { fontSize: 16 },
});
