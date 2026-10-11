/opt/homebrew/Library/Homebrew/cmd/shellenv.sh: line 18: /bin/ps: Operation not permitted
# Bill-Splitting App Product Brief

## 1. Product summary

Working name: Divi

One-sentence description:
A fast, low-friction iOS app for splitting shared expenses, tracking who owes whom, and making repayment accountability obvious.

Primary users:
- Restaurant goers splitting shared meals.
- The person in a friend group who frequently fronts expenses.
- Trip organizers managing expenses across several people.
- Roommates or friends with recurring shared expenses.
- Groups that want a lightweight alternative to manually tracking payments.

Problem being solved:
- Fronting a shared expense creates administrative work for the payer. They must determine what everyone owes, communicate those amounts, track repayments, and follow up with people who have not paid.
- Divi reduces that friction by making expense creation, joining a bill/group, understanding balances, and recording repayment extremely fast.

Primary product principle:
- A user should be able to answer three questions immediately:
    - What do I owe?
    - Who owes me?
    - What action should happen next?

Secondary product principle:
- Creating or joining a shared expense should require as little setup as reasonably possible.

Differentiation:
- Divi should emphasize:
    - Faster expense creation.
    - Strong QR-code-based joining flows.
    - Clear repayment accountability.
    - Minimal navigation and configuration.
    - Strong visual distinction between "you owe" and "you are owed."
    - Easy participation for people who do not already use Divi.
    - Fewer bookkeeping-oriented interactions than traditional expense-management products.

MVP goal:
- Deliver a working iPhone application implementing authentication, groups, members, expenses, multiple split methods, balances, QR invitations, settlements, activity history, and basic account management.
- The codebase should prioritize maintainability, modularity, testability, and the ability to replace individual services or features without major architectural changes.
- Receipt OCR (i.e. Utilize OCR + whatever reason-based technology required to injest receipt information into the UI form)
- Venmo payment request (i.e trigger venmo to the pay page with correct amount and label)

Out of scope for MVP:
- Advanced animations and micro-interactions.
- Web application.
- Android application.
- iPad-specific layouts.
- Direct money movement.
- Complex budgeting.
- Recurring expenses.
- Offline-first synchronization.
- Advanced group roles.
- Production-grade international currency conversion.
- Social feeds or messaging.
- CI Integration. For MVP, lets focus on a working local buildout
- Beli integration

## 2. Platforms and compatibility
- Platform: iPhone only for MVP.
- Initial target: modern iPhones supported by Expo SDK 57 and React Native 0.86.
- UI framework: React Native with Expo and TypeScript.
- Native iOS modules may be introduced behind application-owned adapters only when an Expo or JavaScript capability is insufficient.
- Orientation: Portrait only.
Accessibility:
- The application should support:
- Dynamic Type.
- VoiceOver labels for interactive elements.
- Minimum practical 44x44pt interaction targets.
- Sufficient foreground/background contrast.
- Interfaces that do not rely exclusively on color to communicate state.
- Reasonable layouts at larger accessibility text sizes.
- Reduce Motion where animations are later introduced.
- Accessibility should be considered during component construction rather than retrofitted afterward.

Localization:
- English only for MVP.
- All user-facing strings should nevertheless be structured so localization can be added later without major refactoring.
- Primary locale: en-US.

## 3. Accounts and onboarding
- Authentication methods
    - MVP authentication:
        - Sign in with Apple.
        - Google Sign-In.
        - Sign in with Venmo

Authentication should be abstracted behind an AuthService protocol so providers can be added or removed.

Anonymous use
- Limited guest participation should be supported conceptually, particularly for QR-based bill participation.
- For the first implementation, persistent expense ownership and synchronization require an authenticated Divi account.

The architecture should leave room for a future lightweight guest flow.

Required profile information
- Required:
    - Stable user ID.
    - Display name.

- Optional:
    - Profile photo.
    - Email
    - Phone number.
    - Venmo username.
    - Default currency.
    - Authentication-provider email addresses should not automatically be exposed to other users.

Contact discovery
- Required for the first MVP implementation.
- Invite methods

The architecture should support later:
- Contacts permission.
- Phone/email matching.
- Friend suggestions.


MVP:
- QR code.
- Native iOS share sheet.
- Divi deep/universal link.

Future:
- SMS.
- Contacts.
- Email.
- Account deletion
- Users can request deletion from Settings.

Deletion should:
- Revoke authentication sessions.
- Remove or anonymize personal profile information.
- Preserve historical financial records necessary to maintain other users' expense histories.
- Replace deleted users in historical records with a neutral label such as "Deleted User."
- Remove private profile data where practical.
- Remove unused uploaded assets.
- Financial records should not silently disappear from other users' groups because one participant deletes their account.

Onboarding flow
- User launches Divi.
- Short welcome screen explains the core value proposition.
- User selects Sign in with Apple/Google/Venmo

Authentication completes.
- Divi requests or confirms display name.
- User optionally adds a profile image.
- User enters the Home screen.

Home prominently presents:
- Past/historical expense split instances
- Add Expense (in bottom menu)
- View Receipts (in bottom menu)
- View Profile (in bottom menu)
- Permissions such as camera or contacts are requested only when the relevant feature is used.
- Avoid large permission requests during initial onboarding.

## 4. Core Product Model

A **Divi** is a single shared-expense experience built from a receipt or manual line items. It has a creator, payer, participants, one currency, optional source image, confirmed receipt values, item claims, final allocations, and settlement records.

A Divi moves through:

`Draft → Claiming → Finalized → Settled`

The primary interaction is claiming receipt items rather than manually entering each participant's total. Tax, tip, fees, and discounts are allocated proportionally from claimed-item subtotals. Final allocations must reconcile exactly to the confirmed total.

Detailed entities, fields, service boundaries, and money invariants are defined in [ARCHITECTURE.md](ARCHITECTURE.md).

## 5. Core Experience

The MVP supports:

- Receipt capture from Camera or Photos plus manual entry.
- OCR and structured receipt extraction with complete manual correction.
- QR and universal-link invitations.
- Full-app and App Clip participation.
- Synchronized item claiming, including shared items.
- Creator-controlled finalization.
- Transparent participant allocation breakdowns.
- **Request with Venmo** handoff for finalized balances, with recipient, exact amount, and Divi-derived note pre-populated when Venmo supports those fields.
- Planned post-finalization **Send totals to all** flow: eligible participants may provide an opted-in phone number during QR join, and the creator can explicitly send each person a text with their claimed items, item prices, final total, and a supported Venmo payment link.
- Full and partial repayment records.
- Persistent history after settlement.

The complete lifecycle, entry paths, screen states, and recovery behavior are defined in [USER_FLOWS.md](USER_FLOWS.md).

## 6. Product Rules

- The creator controls Draft financial values and finalization.
- Receipt values are locked during Claiming.
- Returning to Draft removes all claims and requires explicit confirmation.
- Every required item must be claimed before finalization.
- A shared item's cost is divided equally among its claimants.
- A single Divi uses one ISO 4217 currency; MVP performs no conversion.
- Calculations use integer minor units and deterministic remainder assignment.
- Finalized allocations and Settled history are immutable.
- Divi records external repayment but does not move or verify funds.
- Opening Venmo may mark a request as initiated, but only explicit confirmation (or a future verified provider integration) may mark a balance Paid.
- External payment identities are optional; an explicit Venmo username is preferred over assuming that a phone number or email identifies the correct Venmo account.
- Phone numbers are optional messaging destinations only and require explicit SMS consent; sending totals is separate from payment initiation and payment completion.
- Invitations are scoped, revocable, and safely rejected when invalid.
- Duplicate financial mutations must be idempotent.
- Deleted accounts are anonymized without corrupting other participants' history.

Technical enforcement is defined in [ARCHITECTURE.md](ARCHITECTURE.md).

## 7. Design Direction

Divi uses a green, white, and near-black visual system with generous whitespace, rounded controls, strong financial typography, open list rows, and a five-position bottom navigation bar. The elevated center action is **Create Divi**.

The Acorns screenshots under `design/screens/` are design-language references only. Divi must use its own identity, icons, content, illustrations, and product-specific layouts.

The complete token system and screen mappings are defined in [DESIGN_SPEC.md](DESIGN_SPEC.md).

## 8. MVP Completion

MVP completion requires the full receipt-to-settlement journey to work across the full app and scoped App Clip, with exact financial reconciliation, secure authorization, accessible states, documented local setup, successful builds, and automated coverage of critical domain behavior.

The testable checklist is defined in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

## 9. Planned Future Features

### Recoverable Divi deletion

Planned for a post-MVP release: deleting a Divi should use a recoverable two-step flow rather than immediately removing it.

- Immediately after deletion, show a small bottom confirmation banner/toast with a short countdown and an **Undo** action.
- While the countdown is active, **Undo** restores the Divi to its previous lifecycle state and dismisses the confirmation.
- When the countdown expires, move the Divi into a **Recently Deleted** area instead of permanently deleting it.
- Make **Recently Deleted** accessible from the Profile/Settings area.
- Allow the user to restore a recently deleted Divi, subject to authorization and lifecycle rules.
- Keep recently deleted records separate from normal active/history lists, and define a future retention period before permanent deletion.
- Preserve the financial-history and participant safeguards already required for deleted or anonymized records; deleting a user's copy of a Divi must not corrupt another participant's history.

The exact countdown duration, retention period, permanent-deletion policy, and behavior for Divis with active participants or unsettled balances remain open decisions. See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## 10. Architecture and Delivery Summary

The selected foundation is React Native 0.86, React 19, Expo SDK 57, and TypeScript with a Supabase/PostgreSQL backend, Supabase Auth, and replaceable application-owned service boundaries. Local development uses the Supabase CLI Docker stack; the current client persists authenticated Divis through the repository layer. Receipt OCR remains on-device and receipt images are not uploaded by the current flow.

The MVP prioritizes a strong reproducible local build. CI, automated App Store submission, direct money movement, and irreversible production deployment are outside current scope.

Implementation structure, security, data, deployment, and engineering rules are defined in [ARCHITECTURE.md](ARCHITECTURE.md).

## 11. Open Decisions

Provider, privacy, App Clip, Venmo, brand, and production-deployment decisions that are not yet resolved are tracked in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Non-material implementation details may use the simplest documented, replaceable default; decisions affecting financial correctness, security, privacy, external cost, or irreversible state require explicit approval.
