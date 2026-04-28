import { useState } from 'react';
import { parseExpense, toUserMessage } from '../lib/api';
import type { ParsedExpense } from '../lib/types';

interface UseExpenseParsingResult {
  parsedResult: ParsedExpense | null;
  isParsing: boolean;
  error: string | null;
  submit: (text: string, participants: string[]) => Promise<void>;
  clear: () => void;
}

/**
 * Manages the AI expense-parsing flow: loading state, result, and errors.
 *
 * Usage:
 *   const { parsedResult, isParsing, error, submit, clear } = useExpenseParsing();
 *   await submit(text, participants);  // triggers the API call
 *   clear();                           // dismisses the result
 */
export function useExpenseParsing(): UseExpenseParsingResult {
  const [parsedResult, setResult] = useState<ParsedExpense | null>(null);
  const [isParsing, setParsing]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function submit(text: string, participants: string[]) {
    if (!text.trim()) return;
    setParsing(true);
    setError(null);
    try {
      setResult(await parseExpense(text, participants));
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setParsing(false);
    }
  }

  function clear() {
    setResult(null);
    setError(null);
  }

  return { parsedResult, isParsing, error, submit, clear };
}
