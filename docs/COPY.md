# Copy standard

The product's copy is part of the product. This is the one-page rulebook for
every screen, dialog, empty state, error and button. It is short on purpose:
if it takes more than a minute to read, it won't be used.

The standard is **one job, one sentence, one next step**.

1. **One job per screen.** The heading says what the reader can do here.
2. **One idea per sentence.** Short. Active. Second person. Cut 30%.
3. **One next step per state.** Empty, error, loading and forbidden states
   say what happened and what to do now. No dead ends.

## Who we write for

A partnership lead at a B2B company: busy, scanning, accountable for a
number. They are deciding where to spend the next hour, not reading a
brochure. Write for the decision, not the feature list.

## How to write a screen

1. Name the reader and the job.
2. Write the heading as the answer, not the module label.
3. Write the action button.
4. Fill the body: outcome → mechanism → proof.
5. Cut 30%. Read it aloud.
6. Five-second test: show it, hide it, ask "what does this page do and what
   would you click?"

## Words we keep

These are the buyer's words. Use them consistently.

`partner`, `partnership`, `owner`, `sponsor`, `objective`, `review`,
`decision`, `evidence`, `outcome`, `account`, `agreement`, `pipeline`,
`stage`, `health`.

## Words we cut

`leverage`, `seamless`, `robust`, `powerful`, `solution(s)`, `utilize`,
`empower`, `streamline`, `best-in-class`, `world-class`, `cutting-edge`,
`end-to-end`, `very`, `really`, `simply`, `just`.

Also cut internal machine vocabulary from the UI:

| Internal term                        | UI term                          |
| ------------------------------------ | -------------------------------- |
| available transitions                | what you can do next             |
| disposition                          | result                           |
| snapshot                             | progress at review time          |
| immutable                            | can't be changed                 |
| provenance-linked support            | the proof behind this claim      |
| object type / object ID              | record type / record ID          |
| governed relationship                | partnership                      |
| node / edge / cluster                | account / line / group           |
| similarity / IDF / cosine / PageRank | match / shared tools / connected |
| commit import                        | import these partners            |

## Rules for each element

- **Buttons** are verbs. "Import these partners", "Refresh map", "Add
  account" — not "Submit", "Go", "OK".
- **Errors** say what happened and what to do. Never blame the reader.
  "Someone else changed this account. Refresh and try again."
- **Empty states** explain why the screen matters and give the next action.
  "No accounts yet. Add an account or load the example accounts…"
- **Confirmation dialogs** name the object and the consequence. "Import
  these partners?" not "Commit import?".
- **Numbers** use the reader's locale and ICU plurals, never `(s)`.
- **Headings** are sentence case. Named surfaces (Command Center,
  Ecosystem, Evidence & outcomes) keep their name.
- **No fake certainty.** A match is a starting point, not a buying signal.

## Arabic

Transcreate, don't translate. Keep sentences short; Arabic expands. Test
RTL layout for line breaks and button width. Do not transliterate
data-science terms — they should not appear in the UI at all. Examples:

- Ecosystem → المنظومة
- Who to call next → بمن تتواصل بعد ذلك
- What they share → ما تشترك فيه
- How to get in → كيف تصل إليهم
- Refresh map → تحديث الخريطة

## How this stays true

- `apps/web/tests/messages.test.ts` checks English/Arabic key parity, empty
  values, and the banned-word list.
- Every feature review checks the seven states: loading, empty, error,
  forbidden, conflict, success, destructive confirmation.
- Copy is reviewed with the design, before build. Strings are design, not
  decoration.
- New strings go into both `messages/en.json` and `messages/ar.json`. Never
  ship English-only text.
