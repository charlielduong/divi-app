# Divi Architecture

This document is the source of truth for data, services, financial rules, security, and engineering constraints.

## 1. Technology Baseline

- Full iPhone app: React Native 0.86, React 19, Expo SDK 57, and TypeScript.
- App Clip: future native iOS companion target that reuses portable domain contracts where practical; excluded from the first JavaScript-only local preview.
- Backend: Supabase/PostgreSQL. Local development uses the Supabase CLI Docker stack; a future staging/production environment will use a separately deployed self-hosted Supabase stack.
- Database: PostgreSQL.
- Authentication: Supabase Auth with Apple and Google; Venmo identity/sign-in integration remains provider-dependent.
- Realtime: Supabase Realtime for active Divis and claims.
- Private receipt storage: Supabase Storage.
- Administration: Supabase dashboard for MVP.

Supabase SDK calls must remain behind application-owned repositories and services. React Native components must not contain backend queries, authorization policy, or financial calculations.

## 2. Domain Model

### User and authentication identity

`User` stores stable ID, display name, optional contact/profile fields, default currency, and lifecycle timestamps. Provider identities are stored separately from the public profile.

### Divi

Stores creator, payer, currency, lifecycle state, version, source receipt, confirmed totals, and timestamps. State transitions are explicit and validated. A future recoverable-deletion feature should use an auditable soft-delete state/tombstone (including deletion time and actor) so a Divi can move from active lists to Recently Deleted without losing its financial record.

### Participant

Stores Divi/user or guest identity, display-name snapshot, optional phone number and SMS-consent state, join/leave status, and timestamps. Historical participants are never physically removed from financial history. A phone number is a messaging destination only; it is not treated as a verified Venmo identity.

### Receipt and parse attempt

`Receipt` stores private image metadata and the creator-confirmed merchant/date/currency values. `ParseAttempt` records status, confidence/provider metadata, and sanitized failure details.

### Receipt line item and claim

Line items store stable order, description, quantity, and integer minor-unit amounts. `ItemClaim` joins a participant to a line item.

### Final allocation

Stores each participant's immutable item subtotal, tax, tip, fee, discount, and final total at finalization.

### Payment/settlement

Records repayment outside Divi: payer, recipient, amount, currency, date, note, creator, and lifecycle timestamps. It never implies that Divi moved or verified funds.

Track monetary status separately from external handoff activity:

- Obligation status: `outstanding`, `partiallyPaid`, or `paid`.
- Handoff event: provider, initiating user, recipient identifier snapshot, amount, sanitized note, initiation timestamp, and outcome such as `launched`, `unavailable`, or `failed`.

A `launched` Venmo handoff may produce the user-visible **Request initiated** state but does not change the amount paid.

### External payment identity

Stores optional provider-specific identifiers associated with a participant, such as a Venmo username. Phone numbers and email addresses remain separate identifiers and must not be treated as verified Venmo identities. The model must support future providers without changing the Divi or allocation model.

### Invitation and activity

Invitations store a hashed scoped token, expiry, revocation, and Divi ID. Activity entries record important domain changes with sanitized metadata.

### Planned deletion recovery

Deletion recovery is not part of the MVP, but future implementation should define:

- A short client-visible undo window after a confirmed delete, represented as a mutation with an idempotency key rather than a client-only flag.
- A soft-deleted/Recently Deleted state that is excluded from active lists and normal history by default.
- Authorized restore operations that validate the Divi's prior lifecycle state, current version, participant access, and settlement status.
- Audit entries for delete, undo, move-to-recently-deleted, restore, and eventual permanent deletion.
- Retention and permanent-deletion jobs that do not remove records still required for another user's financial history.

## 3. Money and Allocation

- Represent money as integer minor units with an ISO 4217 currency code.
- A Divi uses one currency; MVP performs no conversion.
- Split each multiply-claimed item's base amount equally among its claimants.
- Allocate tax, tip, fees, and discounts in proportion to each participant's allocated item subtotal.
- Persist final calculated allocations rather than relying on UI inputs for reconstruction.
- Use a documented stable ordering for remainder minor units so client fixtures and the authoritative backend agree.

Required invariants:

```text
sum(item allocations) = item subtotal
sum(tax allocations) = tax
sum(tip allocations) = tip
sum(fee allocations) = fees
sum(discount allocations) = discount
sum(participant final allocations) = Divi final total
```

The authoritative finalization operation validates and persists allocations atomically. Client calculations are provisional UI feedback only.

## 4. Service Boundaries

Define replaceable protocols/interfaces for:

- Authentication and identity linking.
- Divi repository and realtime observation.
- Receipt image storage.
- OCR and structured receipt parsing.
- Invitation/deep-link resolution.
- Allocation/finalization.
- Venmo/external payment handoff.
- SMS notification and delivery-status tracking.
- Analytics and crash reporting.

Receipt parsing must return proposed data with confidence/failure information. The manual editor remains available regardless of provider outcome.

### External payment handoff boundary

Divi owns:

`receipt → items → claims → proportional adjustments → final balances`

External providers own:

`requesting money → transferring money → payment completion`

Define a provider-neutral handoff request containing transaction kind, explicit recipient identity when available, exact minor-unit amount and currency, and sanitized label. A Venmo adapter translates only fields supported by the installed/current integration. Unsupported fields must return a structured capability result so the UI can offer copyable values rather than silently dropping information.

No adapter may automatically execute a transaction or treat app launch, request submission, or return-to-app as verified payment. Payment becomes Paid only through explicit authorized confirmation until a future provider offers reliable verification.

### Finalized totals notification boundary

After finalization, the creator may initiate a provider-backed **Send totals to all** operation. Divi prepares a recipient-specific message from immutable allocations: Divi name, claimed item names and prices, final amount owed, and a supported external-payment link when available. The notification service owns SMS transport, consent enforcement, delivery status, retry/idempotency keys, and provider error handling. It must not change claims, allocations, payment status, or settlement state. A Venmo link remains a user-controlled handoff; opening or tapping it never means that money was requested or paid.

## 5. Authorization and Security

- Enforce authorization through Supabase Row Level Security and authoritative server/database operations; client visibility is not authorization.
- Scope participant access to joined or validly invited Divis.
- Permit only the creator to change Draft financial data, reset Claiming, and finalize during MVP.
- Use least-privilege, time-limited access to private receipt images.
- Store session material in Keychain-backed storage.
- Use encrypted transport for all remote traffic.
- Validate upload type, size, and image decoding.
- Never expose tokens, receipts, exact financial data, or personal information in analytics, routine logs, URLs, or crash metadata.
- Store timestamps in UTC while preserving a creator-confirmed logical receipt date.
- Anonymize deleted users while retaining minimum historical records required by other participants.

All mutations that can create financial or participant state require idempotency. Stale lifecycle mutations must fail safely and return the current authoritative version.

## 6. App Architecture

Use a pragmatic feature-oriented structure:

```text
Divi/
  App/
  Core/
    Models/
    Money/
    Networking/
    Authentication/
    DesignSystem/
  Features/
    Authentication/
    Home/
    ReceiptCapture/
    ReceiptConfirmation/
    Invitations/
    Claiming/
    Finalization/
    Settlement/
    Activity/
    Profile/
  Services/
  Repositories/
DiviAppClip/
DiviTests/
DiviUITests/
```

Keep domain calculations framework-independent and share portable contracts with a future App Clip where size and platform constraints permit. Components primarily render state and forward intent. Use explicit dependency boundaries, explicit errors, and independently testable domain types.

Prefer Expo-compatible libraries and standard promises. Avoid floating-point money, heavy DI/UI frameworks, unnecessary state layers, unchecked nullable values in production paths, and provider-specific types escaping infrastructure boundaries.

## 7. Realtime and Concurrency

- Synchronize participant, claim, finalization, and settlement changes in near real time.
- Use optimistic UI only where rollback is clear and safe.
- Resolve conflicts against the authoritative Divi version.
- Finalization is a single atomic transition.
- Duplicate joins, claims, finalizations, and payments must not create duplicate records.

## 8. Configuration and Local Development

- Keep secrets and signing credentials out of source control.
- Provide checked-in environment templates containing names and placeholders only.
- Include database schema, migrations, and representative seed/preview data.
- Provide deterministic development adapters when external credentials or Apple entitlements are unavailable.
- Document setup for Supabase, authentication providers, OCR/reasoning, storage, universal links, App Clip association, and Venmo handoff.
- The iOS Simulator may use `http://127.0.0.1:54321`; a physical iPhone uses Metro LAN mode for the JavaScript bundle and the current ngrok HTTPS tunnel for the local Supabase API/Auth path. Local Google OAuth on a phone requires that reachable HTTPS tunnel because the loopback callback is not reachable from the phone. The ngrok hostname must be updated in the client environment, Supabase Auth configuration, and Google Cloud callback registration when it changes.

MVP prioritizes a reliable local build and test environment. CI, automated App Store submission, production payment processing, and fully automated production infrastructure remain out of scope until a deployment environment is approved.

## 9. Scale and Operations

Design initially for hundreds to low thousands of users and a path to tens or hundreds of thousands without changing the fundamental domain model. Avoid premature optimization. Analytics may record coarse product events but never receipt content, descriptions, exact amounts, or sensitive identities.

## 10. Delivery Rules

- Use coherent commits for meaningful milestones.
- Keep README, architecture notes, migrations, environment templates, and build/test commands current.
- Use mocks only where real credentials, entitlements, provider approval, or domain ownership are unavailable.
- Do not deploy publicly or make irreversible infrastructure changes without explicit approval.
