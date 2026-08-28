# identity-branch-department-listing — plan overview

## Stories

| NN | File | Title | Depends on |
| --- | --- | --- | --- |
| 35 | [35-story-identity-branch-department-listing.md](./35-story-identity-branch-department-listing.md) | Backend Foundation: Branch & Department Listing | `project-foundation` Story 02/03 |

## Dependency notes

- Extends the existing `IdentityModule` (`identity.service.ts`, `users.controller.ts`) — no new module.
- Adds one new permission key (`branch:read`) to the existing `seed.ts` catalog. No schema/migration change.
- Part of the approved 35/36/37 backend-foundation batch — zero file overlap with Stories 36/37 beyond the shared, purely-additive `seed.ts` permission array.
