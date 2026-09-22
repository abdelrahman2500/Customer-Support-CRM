# standardize-query-state-ui — plan overview

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 155 | (implemented directly — see commit) | Standardize query state UI | — | Story S-7 (`QueryStateCard`), Story 154 |

## Classification (measured at `2b17c7c`)

36 files carry hand-rolled loading/error branches — 50 loading, 59 error — against 6 `QueryStateCard` adoptions. They are **not** one homogeneous group:

| Shape | Files | Migratable |
|---|---|---|
| 1 loading / 1 error / 1 empty / 1 retry, list + table | 9 | **yes — mechanical** |
| Multi-query pages (ticket detail 5/6, customer detail 2/2, dashboard 2/2) | ~6 | no — each branch belongs to a different query and section |
| Form submit errors (`create-ticket-view`, `create-user-view`) | ~4 | no — mutation errors, not query state |
| Detail views with not-found vs generic error split | ~5 | no — `QueryStateCard` has no 404 branch |
| Inline sub-card states (chat, attachments, KB refs) | ~12 | no — nested inside another card's body |

## Scope taken

Three of the nine mechanical files: `ticket-categories-view`, `kb-categories-view`, `quick-replies-view`. Identical shape, each with existing state coverage (42 tests between them) that passes unchanged — which is the evidence the migration preserved behaviour.

The remaining six mechanical files are deliberately left: the batch proves the pattern, and the surface stories that follow will touch several of them anyway.

## Deliberately excluded

- The ~27 non-mechanical files above. Forcing them through `QueryStateCard` would lose a 404 branch, a mutation error, or a per-query distinction.
- Any change to query logic, retry behaviour, or empty copy.
