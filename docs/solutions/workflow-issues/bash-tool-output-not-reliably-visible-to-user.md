---
title: "Bash tool output is not reliably visible to the user — paste results into response text"
module: ai_workflow
date: 2026-09-21
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Showing a git/gh diff, log output, or any command result the user needs to actually read"
  - "Walking a user through reviewing multiple PRs, files, or command outputs one at a time"
  - "Any point where the next step depends on the user having seen specific tool output"
tags: [bash-tool, output-visibility, pr-review, harness-behavior, vscode-diff]
related_components: ["cli_tooling"]
---

# Bash tool output is not reliably visible to the user

## Context

While walking Navin through reviewing several open PRs one at a time, `gh
pr diff <n>` was run via the Bash tool and the assistant's response
referred to "the diff shown above" — but the user could not see it and
said so directly ("wheres the diff", "i cant see any diff"). The
session's own harness instructions state this plainly: *"Command output
is displayed to you, not reliably to the user."* That line was read but
not internalized in practice until the user hit the gap directly.

## Guidance

Running a Bash command and narrating over its output ("as shown above",
"the diff above") is not sufficient when the user needs to actually read
the result. Two remedies apply depending on what's needed:

1. **Paste the actual content into the response text.** For a diff, log
   excerpt, or any result the user needs to read in the conversation
   itself, copy the real output into the assistant's own message — not a
   paraphrase, not a summary claiming to show it, the literal content
   (e.g. fenced in a \`\`\`diff block).
2. **Open it in a real editor when the user wants to *work* with it, not
   just read it.** When the user asked to see a diff "on editor screen,"
   plain terminal text wasn't the ask — they wanted VS Code. Two concrete
   mechanisms used successfully in this session:
   - `code <path>` opens a single file.
   - `code --diff <fileA> <fileB>` opens a real side-by-side diff view.
     For a PR branch vs. a base branch, materialize both sides first with
     `git show <ref>:<path> > /tmp/<name>` for each ref, then diff the two
     temp files — this works even when the PR branch isn't checked out
     locally.

## Why This Matters

The assistant and the user do not share a terminal. The assistant's tool
results land in the assistant's own context; nothing about running a
Bash command pushes that output to the user's screen. Assuming otherwise
produces a response that reads as complete on the assistant's side while
leaving the user with nothing to act on — and, repeated across multiple
turns (as happened here, advancing from PR to PR while the user still
hadn't seen the first diff), compounds into visible frustration before
the actual gap is named.

## When to Apply

- Any time a Bash/tool result is the actual deliverable of a turn (a
  diff, a log tail, a query result) rather than an input to further
  reasoning — assume the user has not seen it until it is either pasted
  into the response text or opened in a UI they've been told about.
- Especially relevant in multi-step review workflows (PR-by-PR, file-by-
  file) where an early miss compounds silently across several turns
  before the user flags it.

## Examples

**Before** (assumed-visible, not pasted):
```
<runs `gh pr diff 57` via Bash>
"PR #57 — clean, minimal, exactly as described..."
```
User: "wheres the diff"

**After** (pasted directly into the response):
```
**PR #57 — `fix: trim leading/trailing whitespace from signup name`**

​```diff
--- a/backend/src/schemas/authSchema.ts
+++ b/backend/src/schemas/authSchema.ts
@@ -41,6 +41,7 @@ export const signupSchema = z.object({
   name: z
     .string()
+    .trim()
     .min(1, 'Name is required')
​```
```

**When the user wants to work in an editor, not just read text:**
```bash
git show origin/master:backend/src/schemas/authSchema.ts > /tmp/pr57-diff/authSchema.master.ts
git show origin/fix/issue-49-trim-name-whitespace:backend/src/schemas/authSchema.ts > /tmp/pr57-diff/authSchema.pr57.ts
code --diff /tmp/pr57-diff/authSchema.master.ts /tmp/pr57-diff/authSchema.pr57.ts
```
