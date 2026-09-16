# VectorMint Card Catalog Implementation Handoff

This document is a build plan for an LLM/code agent continuing the VectorMint
credit card catalog integration. Read this before making implementation changes.

## Goal

Refactor the credit card rewards catalog so card benefit data can be imported
from VectorMint, normalized into the app's existing card/reward/perk structure,
reviewed by an admin, and then safely committed for normal user use.

The import must not replace the existing manual architecture all at once. It
should add infrastructure around the current card database and card management
modal, preserve manually resolved decisions, and keep benefits that cannot be
valued or cleanly matched visible but excluded from calculations.

## Current Context

- The app already has a credit card rewards backend and frontend page.
- Existing card types, earning rewards, perk awards, account mappings, benefit
  cycles, perk completion tracking, and rewards optimization are already in use.
- VectorMint support has already started:
  - `node/src/services/vectorMint/vectorMintClient.js`
  - `node/src/services/vectorMint/vectorMintCardMapper.js`
  - `node/src/services/vectorMint/vectorMintCardCatalogService.js`
  - `GET /api/credit-card-rewards/vector-mint/preview`
- The current VectorMint comparison modal exists, but the requested direction is
  to remove it and move review/update behavior into the card management modal.
- VectorMint API access is configured with `VECTOR_MINT_API_KEY` in `node/.env`.
  Do not print this value or include it in logs.

## Product Behavior

- Admin users can update the card catalog from VectorMint inside the card
  management modal.
- Non-admin users cannot import, review, create, update, or delete global card
  types.
- Imported cards that are new or materially changed should enter review before
  they are available to assign to accounts or considered in new-card
  recommendations.
- A card in review should have a visible indicator in admin card management.
- Clicking a card in review should open the normal card management form with
  that card filled out.
- Saving an in-review card commits the details and moves the card to the active
  catalog.
- Existing active cards should not be made unusable merely because VectorMint
  has extra or conflicting data. Prefer adding review metadata/benefit rows over
  breaking existing assigned cards.
- Benefits that cannot be valued, matched to a known category, or tracked with
  reliable transaction labels should remain stored with the rest of the data and
  display as excluded/greyed-out.
- Excluded or review-needed benefits must not affect calculations,
  optimization, earned totals, or candidate-card recommendations.

## Naming And Status Model

Avoid the term `classification` for whether a benefit is calculated. It is too
ambiguous. Use explicit status fields.

Recommended statuses:

- Card type status:
  - `active`: available for account assignment and recommendations.
  - `in_review`: visible to admins only in review workflows; not assignable and
    not recommended.
- Benefit status:
  - `included`: participates in calculations.
  - `needs_review`: stored and visible, but excluded from calculations until an
    admin reviews it.
  - `excluded`: stored and visible, but intentionally excluded from
    calculations.

Recommended metadata fields:

- `source`: `manual` or `vectormint`.
- `external_source`: use `vectormint` for VectorMint-linked cards.
- `external_card_id`: VectorMint card id.
- `external_reward_id` / `external_perk_id`: VectorMint benefit id when
  available.
- `source_description`: original VectorMint wording for review/debugging.
- `status_reason`: why the benefit is included, needs review, or excluded.
- `review_reason`: why a card needs admin review.
- `last_external_sync_at`: timestamp of the last VectorMint comparison/import.
- `source_fingerprint`: stable hash of normalized external details used to avoid
  reintroducing resolved review items.

## Database Shape

Add a new migration. Do not rewrite old migrations.

Recommended migration name:

- `node/src/db/migrations/018_credit_card_rewards_vector_mint_import.sql`

Add columns to `credit_card_types`:

- `status TEXT NOT NULL DEFAULT 'active'`
- `source TEXT NOT NULL DEFAULT 'manual'`
- `external_source TEXT`
- `external_card_id TEXT`
- `source_description TEXT`
- `review_reason TEXT`
- `source_fingerprint TEXT`
- `last_external_sync_at TIMESTAMPTZ`

Add columns to `credit_card_earning_rewards`:

- `status TEXT NOT NULL DEFAULT 'included'`
- `source TEXT NOT NULL DEFAULT 'manual'`
- `external_reward_id TEXT`
- `source_description TEXT`
- `status_reason TEXT`
- `match_strategy TEXT`
- `source_fingerprint TEXT`

Add columns to `credit_card_perk_awards`:

- `status TEXT NOT NULL DEFAULT 'included'`
- `source TEXT NOT NULL DEFAULT 'manual'`
- `external_perk_id TEXT`
- `source_description TEXT`
- `status_reason TEXT`
- `match_strategy TEXT`
- `source_fingerprint TEXT`

Add constraints:

- card type status in `('active', 'in_review')`
- benefit status in `('included', 'needs_review', 'excluded')`

Add indexes:

- unique external card link:
  - `(external_source, external_card_id)` where both are not null
- unique external earning reward link:
  - `(credit_card_type_id, source, external_reward_id)` where
    `external_reward_id` is not null
- unique external perk link:
  - `(credit_card_type_id, source, external_perk_id)` where
    `external_perk_id` is not null
- optional lookup indexes on card/benefit `status`

Existing manual rows should default to `active`/`included`/`manual`.

## Do Not Reintroduce Resolved Reviews

Subsequent VectorMint imports must not recreate review work that an admin has
already resolved.

Use fingerprints for this:

- Normalize card and benefit details before hashing.
- Fingerprint stable semantic fields, not volatile ordering or timestamps.
- For earnings:
  - normalized display category/name
  - reward percent
  - keywords
  - source description
  - external id when present
- For perks:
  - normalized name
  - dollar value
  - frequency count/period
  - auto-complete flag
  - source description
  - external id when present
- For cards:
  - name
  - annual fee
  - normalized benefit fingerprints

Import behavior:

- If an existing imported benefit has the same fingerprint, leave its status
  untouched. This preserves admin decisions like `included` or `excluded`.
- If a benefit external id matches but the fingerprint changes, update the
  source data and set status to `needs_review` unless the change is trivial.
- If a resolved manual/internal benefit already matches the new external benefit
  signature, link metadata without creating a duplicate.
- If a new external benefit does not match anything, insert it with
  `needs_review`, `included`, or `excluded` based on mapper confidence.
- If a card was reviewed and active, do not set the whole card back to
  `in_review` unless the card-level fingerprint has a meaningful change such as
  a different annual fee or major benefit changes.

This is the key production safeguard for keeping imports useful instead of
noisy.

## VectorMint Pull Strategy

Use the documented VectorMint endpoints:

- `GET /v1/cards`
- `GET /v1/cards/{id}` only if needed and working

Current observed behavior:

- `/cards` returns paginated cards with enough detail for many records.
- `/cards/{id}` and child detail endpoints have previously returned errors in
  local testing, so the client should prefer detailed list payloads and degrade
  gracefully.

Client requirements:

- Paginate with a reasonable limit.
- Time out requests.
- Do not log API keys.
- Convert upstream failures into useful app errors.
- Keep VectorMint specifics isolated under `node/src/services/vectorMint/`.

## Mapping Rules

The mapper should produce internal card records with:

- `name`
- `annualFee`
- `earningRewards`
- `perkAwards`
- excluded/review-needed benefits represented in the same arrays with `status`
- `sourceDescription`
- `external ids`
- `statusReason`
- `matchStrategy`
- fingerprints

Avoid duplicate generic names. If VectorMint returns multiple benefits with the
same visible category/name, make the app label more specific.

Examples:

- Prefer `Amex Travel Hotels` over `Amex Travel` with hotel detail hidden in the
  description.
- Prefer `Amex Travel Flights` over a generic `Amex Travel`.
- Prefer `Chase Travel Hotels` / `Chase Travel Flights` over generic
  `Chase Travel` when the source description supports it.
- Prefer `Hyatt Hotels`, `IHG Hotels`, `Whole Foods`, `Amazon`, and other
  specific vendor-backed names when the vendor is durable and trackable.

Benefit inclusion rules:

- Include when it maps cleanly to existing app categories or stable vendor
  keywords.
- Mark `needs_review` when there is a preliminary rule but transaction labeling
  may vary by card/account.
- Mark `excluded` when the benefit is vague, not valuably trackable, or has no
  reliable transaction signal.

Known category interpretations from existing app usage:

- Drug store rewards should map to `Pharmacies`/drug-store Plaid behavior, not a
  standalone manual category unless the app later defines one.
- Streaming, broad transit, broad phone/internet/cable/streaming bundles, and
  vague partner affiliations are usually excluded unless there are stable vendor
  keywords.
- Non-annual or infrequent credits like Global Entry/TSA PreCheck are excluded
  unless the product direction changes.

## Merge Algorithm

Create an import service rather than placing merge logic in the route.

Suggested file:

- `node/src/services/vectorMint/vectorMintCardImportService.js`

High-level flow:

1. Assert current user is admin.
2. Fetch current catalog from `creditCardRewardsModel.findRewardCatalog()`.
3. Fetch VectorMint cards through `createVectorMintClient().fetchCards()`.
4. Normalize VectorMint cards.
5. Match each external card to an existing card by:
   - exact external id link
   - exact normalized name
   - conservative issuer/product token matching
6. For matched cards:
   - set external metadata if missing.
   - merge new benefit rows.
   - preserve resolved statuses when fingerprints match.
   - flag card-level review only for meaningful conflicts.
7. For unmatched VectorMint cards:
   - insert as `in_review`.
   - insert mapped benefits with their statuses.
8. Return an import summary and the refreshed reward catalog.

Summary fields should include:

- `fetched_count`
- `matched_count`
- `created_review_count`
- `updated_count`
- `unchanged_count`
- `benefits_added_count`
- `benefits_updated_count`
- `benefits_preserved_count`
- `review_required_count`
- `warnings`

## Backend API

Add an admin-only import route:

- `POST /api/credit-card-rewards/vector-mint/import`

Response shape:

```json
{
  "import_summary": {
    "fetched_count": 212,
    "matched_count": 20,
    "created_review_count": 12,
    "benefits_added_count": 30,
    "review_required_count": 8,
    "warnings": []
  },
  "rewards": {
    "card_types": []
  }
}
```

Keep or remove preview endpoint based on frontend usage. The old standalone
VectorMint comparison modal should be removed from the UI.

Update mutation guards:

- Card type create/update/delete remains admin-only.
- VectorMint import is admin-only.
- Assigning a card type to a credit card account must reject `in_review` card
  types.

## Calculation Rules

All reward calculations must filter benefits by status.

Only use:

- card type `status === 'active'`
- earning/perk `status === 'included'`

Apply this to:

- card tile earned totals
- earnings category transaction matching
- perk totals and progress bars
- credit card expenses
- optimization recommendations
- new-card recommendations
- account assignment options

Excluded and needs-review benefits should display in the card tile, but greyed
out and excluded from totals.

## Frontend Plan

Remove the standalone VectorMint modal:

- `frontend/src/Components/Dashboard/Modals/VectorMintComparisonModal.tsx`
- `frontend/src/Components/Dashboard/Modals/VectorMintComparisonModal.test.tsx`
- hamburger menu entry for `VectorMint card comparison`
- related open/close state in `Dashboard/index.tsx`
- related props in `DashboardToolbar` and `DashboardActionsMenu`

Integrate into card management:

- `frontend/src/Components/Dashboard/Modals/CreditCardTypesModal.tsx`
- existing Settings modal tab for card types should remain the entry point.
- Add internal tabs:
  - `Manage cards`
  - `Review imports`
- Add an admin-only `Update from VectorMint` button.
- While importing, disable the import button and show a concise loading state.
- After import, show a compact summary.
- In the review tab, list cards needing review with:
  - card name
  - annual fee
  - review reason
  - counts of included/needs-review/excluded benefits
- Clicking a review card should switch to `Manage cards` and load that card in
  the existing form.
- The card form should expose benefit `status` so admins can mark a row as
  included, needs review, or excluded.
- Source descriptions/status reasons should be visible but visually secondary.
- Avoid crowding the modal; use compact rows and consistent column sizing.

Credit card rewards page:

- Account card type selector should omit `in_review` card types.
- Card tiles should still render excluded/needs-review benefits for selected
  active card types, greyed out with a small explanation.
- Empty included/excluded benefit sections should not show placeholder text.

## Initial Data Pull

After the migration and import service are implemented:

1. Run the migration against the configured database.
2. Run the VectorMint import once as an admin operation.
3. Verify import summary counts.
4. Inspect a few important cards:
   - American Express Gold Card
   - American Express Platinum Card
   - American Express Blue Cash Preferred
   - Capital One Venture X
   - Chase Freedom Flex
   - Chase Freedom Unlimited
   - Prime Visa
5. Confirm:
   - no duplicate generic benefit names like repeated `Amex Travel`.
   - excluded benefits are stored in the normal benefit tables.
   - active assigned cards remain available unless explicitly reviewed.
   - in-review cards are not assignable or recommended.
   - rerunning import does not re-open unchanged resolved items.

## Tests To Add Or Update

Backend:

- VectorMint mapper:
  - maps detailed travel labels such as `Amex Travel Hotels`.
  - assigns `included`, `needs_review`, and `excluded` statuses correctly.
  - preserves unvalued/excluded benefits in reward/perk arrays.
  - generates stable fingerprints independent of source ordering.
- Import service:
  - creates unmatched cards as `in_review`.
  - merges matched cards without duplicating benefits.
  - preserves resolved statuses on unchanged fingerprints.
  - reopens review only when external details materially change.
  - returns useful summary counts.
- Credit card rewards service:
  - excludes non-included benefits from totals and optimization.
  - rejects account assignment to `in_review` card types.
- Permissions:
  - import route is admin-only.
  - create/update/delete safeguards still hold.

Frontend:

- Card management modal:
  - shows internal `Manage cards` and `Review imports` tabs.
  - admin can trigger VectorMint import.
  - non-admin cannot see import/review controls.
  - clicking a review card loads it in the form.
  - benefit status can be changed and submitted.
- Dashboard menu:
  - no standalone VectorMint comparison option.
- Credit card rewards page:
  - in-review card types are not in account selectors.
  - excluded/needs-review benefits render greyed out and do not contribute to
    displayed totals.

Run focused tests first, then full backend and frontend test suites if time
allows.

## Production Notes

- Keep VectorMint-specific logic isolated.
- Keep manual card management fully functional.
- Do not silently delete manual benefits during import.
- Prefer additive imports and review flags over destructive replacement.
- Avoid noisy review churn with fingerprints.
- Make status names visible and predictable.
- Keep API responses explainable enough for debugging without exposing secrets.
- Log import failures without API keys or raw credential-bearing URLs.
- If VectorMint details are missing or ambiguous, store the benefit with
  `needs_review` or `excluded` instead of guessing.

