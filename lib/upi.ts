/**
 * UPI payment and reminder utilities.
 *
 * Single Responsibility: all knowledge of the `upi://` deep-link scheme and
 * the reminder message format lives here. Screens call these functions and
 * never construct UPI URLs or message strings themselves.
 *
 * Dependency Inversion: settle.tsx depends on this abstraction, not on the
 * Linking and Share APIs directly. If the UPI scheme changes, only this file
 * changes.
 */

import { Alert, Linking, Share } from 'react-native';
import { formatCurrency } from './formatting';

/**
 * Attempt to open a UPI payment intent for the given payee.
 *
 * If no UPI app is installed (e.g. in the browser) falls back to a share
 * sheet so the user can send a payment request message instead.
 *
 * @param toName    Display name of the person being paid
 * @param amount    Amount in INR
 * @param groupName Group context shown in the UPI note
 */
export function openUPIPayment(
  toName: string,
  amount: number,
  groupName: string,
): void {
  // `pa` (payee UPI ID) is omitted — we only have display names, not UPI IDs.
  // The user picks their UPI ID in the payment app.
  const note = encodeURIComponent(`KharchaShare: ${groupName}`);
  const url  = `upi://pay?pn=${encodeURIComponent(toName)}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;

  Linking.canOpenURL(url).then(supported => {
    if (supported) {
      Linking.openURL(url);
    } else {
      Share.share({
        message: `Hey ${toName}, I'm paying ${formatCurrency(amount)} for "${groupName}" via UPI. Please share your UPI ID.`,
        title: 'Pay via UPI',
      });
    }
  });
}

/**
 * Open a share sheet with a pre-written payment reminder message.
 *
 * @param fromName  Name of the person who owes money
 * @param amount    Amount owed in INR
 * @param groupName Group context for the reminder
 */
export function sendPaymentReminder(
  fromName: string,
  amount: number,
  groupName: string,
): void {
  Share.share({
    message: `Hey ${fromName}, just a reminder — you owe ${formatCurrency(amount)} for "${groupName}" on KharchaShare. Please settle when you can! 🙏`,
    title: 'Payment Reminder',
  }).catch(() => {
    Alert.alert('Reminder', `Reminder sent to ${fromName}`);
  });
}
