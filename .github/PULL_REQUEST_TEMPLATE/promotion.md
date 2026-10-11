<!-- Use for the staging -> master promotion PR only:
     open the PR with ?template=promotion.md appended to the compare URL.
     Merge with a MERGE COMMIT (not squash) so staging stays an ancestor of master. -->

## Promote staging to production

### What changed (since the last production release)
<!-- Paste the output of:
       node scripts/eas-release-notes.js --list <last-master-sha> origin/staging
     The eas-staging workflow also prints this list in its job summary. -->

-

### Checklist (owner)
- [ ] Tested on the staging app (login, create expense, deep link opens the STAGING app only)
- [ ] Any migration in this range was seen applied on the staging DB
- [ ] Destructive migrations follow expand/contract (old live app still works against the new schema)
- [ ] `pg_dump` of the production DB taken if this PR contains a migration
- [ ] All required checks green on this PR (same checks as any master merge)
