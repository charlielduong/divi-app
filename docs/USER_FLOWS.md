# Divi User Flows

This document is the source of truth for user-visible workflows and screen behavior. Product intent lives in `PRODUCT_BRIEF.md`; data and service implementation live in `ARCHITECTURE.md`; visual treatment lives in `DESIGN_SPEC.md`.

## 1. Divi Lifecycle

A Divi moves through `Draft → Claiming → Finalized → Settled`.

- **Draft:** the creator captures, parses, and corrects receipt information. Only the creator may change financial data. Participants cannot claim items.
- **Claiming:** the confirmed receipt is locked. Participants join and claim items. Totals remain provisional.
- **Finalized:** claims are locked and authoritative participant allocations are persisted.
- **Settled:** every repayment obligation has a zero remaining balance. History remains available.

## 2. Authentication and Entry

### Standard onboarding

1. The user opens Divi and sees a short value proposition.
2. The user signs in with Apple, Google, or Venmo.
3. Divi confirms the display name and optionally collects a profile image.
4. The user reaches Home.
5. Camera, Photos, contacts, and notification permissions are requested only when a related feature is used.

### Invitation entry

- A signed-in full-app user follows the invitation directly to the invited Divi.
- A signed-out full-app user returns to that Divi after authentication.
- A user without the app enters the scoped App Clip experience when eligible.
- App Clip participation requires only lightweight identity and must not force full account creation.

## 3. Create a Divi

1. The user taps the elevated center **Create Divi** action.
2. The user captures a receipt, selects one from Photos, or chooses manual entry.
3. Divi creates a Draft with the creator as its first participant and default payer.
4. The receipt-parsing service proposes merchant, date, currency, line items, quantities, prices, subtotal, discounts, tax, tip, fees, and total.
5. The creator reviews the source image and every proposed value.
6. The creator may rename, add, delete, or duplicate items and edit receipt-level amounts.
7. A failed, incomplete, low-confidence, or timed-out parse opens the same editor with missing values ready for manual entry.
8. Divi displays any difference between the entered receipt total and calculated total.
9. The creator resolves blocking discrepancies and confirms the receipt.
10. The Divi moves to Claiming and the financial data becomes locked.

## 4. Invite Participants

1. Divi creates a scoped, revocable invitation token after Claiming begins.
2. The creator displays its QR code or shares its universal link through the iOS share sheet.
3. The invitation resolves to the specific Divi and exposes only participant-appropriate access.
4. Invalid, expired, revoked, or cross-Divi tokens show a safe error and grant no access.

## 5. Join a Divi

1. The recipient scans the QR code or opens its link.
2. Divi shows the merchant/title, creator, total, and current participant count.
3. The recipient confirms a display name when needed, may optionally provide a phone number and SMS consent, and chooses **Join Divi**.
4. The participant and current claims synchronize.
5. The participant enters item claiming.

The App Clip exposes only join, claim, provisional total, final summary, and relevant recovery states for the invoked Divi. It does not show full-app onboarding or global navigation.

## 6. Claim Receipt Items

1. Participants see every receipt item with its description, quantity, price, and claimants.
2. A participant may claim or unclaim an item while the Divi is Claiming.
3. Multiple participants may claim one item; its base cost is divided equally among them.
4. Claims synchronize across active participants.
5. Each participant sees their provisional item subtotal and proportional tax, tip, fee, and discount allocation.
6. The creator sees participants, claimed and unclaimed items, allocated and unallocated subtotals, and provisional participant totals.

Example: an $18 item claimed by three people allocates $6 to each before proportional adjustments. Uneven minor units use the deterministic rounding rules in `ARCHITECTURE.md`.

## 7. Reset Claiming to Draft

Receipt values cannot change during Claiming. To correct them:

1. The creator chooses to reset the Divi.
2. Divi explains that every existing claim will be removed.
3. The creator explicitly confirms.
4. Claims are invalidated and the Divi returns to Draft.
5. The creator edits and reconfirms the receipt before inviting participants to claim again.

## 8. Finalize a Divi

1. The creator chooses **Finalize Divi**.
2. Divi verifies that receipt values reconcile, at least one participant exists, every required item has a claimant, and every component can be allocated exactly.
3. Blocking issues are listed with direct paths to resolve them.
4. Divi shows a final review containing the payer, receipt total, participants, items, adjustments, allocations, and any rounding remainders.
5. The creator confirms.
6. Claims become immutable, final allocations persist atomically, and all participants receive the Finalized state.

### Send finalized totals by text (planned)

1. After finalization, the creator opens the final review and chooses **Send totals to all**.
2. Divi previews the recipients, phone-number consent status, final amount owed, and message contents before sending.
3. The creator explicitly confirms the send. Participants without a phone number or SMS consent are excluded and clearly identified.
4. Each eligible participant receives a text containing the Divi name, their claimed items with individual prices, their final total, and a tappable payment link when a supported Venmo identity/link is available.
5. A participant who joined through the QR flow sees a confirmation such as “Thanks — we’ll text you when your total is ready” after saving their optional phone number.
6. Divi records notification status separately from payment status. Sent, failed, and retrying messages are visible to the creator without implying that a Venmo request was submitted or that the balance was paid.

## 9. Review Final Allocation

Each participant sees claimed items, item subtotal, tax, tip, fees, discounts, final amount, the person they owe, and settlement status. The payer sees their personal responsibility, total reimbursement outstanding, and each participant's obligation.

Provisional and Finalized values must always use distinct text labels and appearance.

## 10. Settle

Divi owns the calculation of who owes whom and how much. Venmo and future payment services are optional external settlement rails.

### Request with Venmo

For a finalized balance owed to the current user:

1. Divi shows **Request with Venmo** next to the participant's outstanding balance.
2. The user taps the action.
3. Divi prefers the participant's explicit Venmo username and does not assume that a phone number or email maps to the correct Venmo account.
4. Divi uses a supported Venmo deep link/app handoff when available.
5. Divi attempts to pre-populate the recipient, exact outstanding amount, a non-sensitive note derived from the Divi name, and request/charge transaction type.
6. The user reviews the request inside Venmo and manually submits it.
7. Divi may record **Request initiated** because the handoff launched; this does not assert that the request was submitted or the balance was paid.

Example:

`Alex owes you $42.18 → Request with Venmo → @alex, $42.18, “Dinner at Barcelona” prepared in Venmo → user reviews and taps Request`

If Venmo cannot reliably pre-populate a field, Divi opens the best supported destination and presents recipient, amount, and note in an easy-to-copy fallback before or after the handoff. A missing or unsupported Venmo app must never block settlement through another method.

### Record settlement

1. An authorized user explicitly records a full or partial repayment in Divi.
2. The monetary obligation remains Outstanding, becomes Partially Paid, or becomes Paid based on its remaining amount.
3. **Request initiated** is tracked separately from payment status; launching or submitting an external request is not payment verification.
4. When every obligation is Paid, the Divi becomes Settled.
5. Receipt, allocation, handoff, activity, and settlement history remain available.

## 11. Global Screen Structure

The authenticated full app uses five bottom-navigation positions:

1. Home
2. Receipts
3. Create Divi
4. Activity
5. Profile

**Create Divi** is an elevated center action, not an ordinary selected tab.

### Home

Shows active Claiming Divis, unpaid Finalized Divis, amounts awaiting reimbursement, and recent history. Empty, loading, retry, offline/stale, and authenticated-session-expired states are required.

### Receipts and history

Shows merchant/title, date, total, lifecycle state, payer, and the current user's responsibility. Users can filter by lifecycle state and resume authorized Draft or Claiming work.

### Activity

Shows significant events such as receipt confirmation, participant joining, claims, finalization, and payment records without exposing sensitive data to unauthorized users.

### Profile and settings

Shows display name, image, default currency, optional Venmo username and other external payment identities, authentication methods, privacy controls, sign out, account deletion, and (when implemented) access to **Recently Deleted** Divis.

### Planned: delete and recover a Divi

This is a future, post-MVP flow:

1. An authorized user chooses to delete a Divi and confirms the destructive action.
2. Divi removes the item from active lists and shows a bottom confirmation banner/toast with a short countdown.
3. The confirmation includes **Undo**. Selecting it before the countdown expires restores the Divi to its prior lifecycle state.
4. If the countdown expires, Divi places the record in **Recently Deleted** rather than permanently deleting it.
5. The user can open **Profile/Settings → Recently Deleted**, review deleted Divis, and restore an eligible record.
6. The UI clearly distinguishes a recoverable deletion from permanent deletion. A future retention policy determines when a record may be permanently removed.

The flow must handle network failure, stale state, duplicate taps, unauthorized restore/delete attempts, and Divis with outstanding balances or other participants without silently changing financial history.

## 12. Screen-State Requirements

Every network-backed screen must define:

- Initial loading.
- Empty content.
- Recoverable error with retry.
- Stale or conflicting state.
- In-progress mutation with duplicate submission prevention.
- Success confirmation that remains understandable without animation.
- Accessibility behavior at large Dynamic Type sizes.

Detailed visual mappings and reference-image usage are defined in `DESIGN_SPEC.md`.
