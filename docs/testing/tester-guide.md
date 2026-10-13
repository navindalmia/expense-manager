# Tester guide: Expense Manager (Staging)

This page is for people testing new builds before they reach the live app. You do not need a GitHub account to read it or to install the app.

## What "staging" is

- **Expense Manager (Staging)** is a separate copy of the app that talks to a separate test server and an empty test database.
- Nothing you do there touches real users or real data. Test accounts, groups and expenses may be wiped at any time.
- It installs **next to** the live app. Tell them apart by the **orange "S" icon** and the **orange STAGING strip** at the top of every screen.

## Install

1. Open the **[Releases page](https://github.com/navindalmia/expense-manager/releases)** on your Android phone.
2. Open the newest entry marked **Pre-release**. Its notes say what changed and what to test.
3. Use the install link given for that build (an `.apk` file from Expo). Download it and install it. Android may ask you to allow installs from your browser; allow it for this one install.
4. If the install refuses to update an older staging build, uninstall "Expense Manager (Staging)" first and install again. This does not affect the live app.

## First use

1. Open the app and **sign up** with any email address (for example `yourname+test@example.com`). Staging sends **no emails** and does not require verification.
2. Create a group, add an expense, try themes, labels and categories.
3. The first request after the server has been idle can take up to a minute (free hosting wakes up slowly). If you see "Network error" at first, wait a minute and try again.

## What to test

Each pre-release lists **What to test** for that build. In addition, on every build please try:

- **Keyboard:** on Create Expense, tap Title, Amount and Notes. What you type must stay visible above the keyboard.
- **Pickers:** open the category, label and theme pickers, type in the search box, tap **+ Add new**, and check the **Create** button is visible above the keyboard.
- **Splits and payer:** create an expense paid by someone other than yourself; it must save with that payer.

## Report a problem

Open an issue at <https://github.com/navindalmia/expense-manager/issues/new> (or send the same details to the person who gave you the build). Include:

1. The build: the release name (for example `staging-20261012-93383ee`) or the version shown under **About** in the app.
2. The screen and the exact steps you took.
3. What you expected and what actually happened.
4. A screenshot or short screen recording.

## Known issues

Issues already tracked are listed under the **known-issue** label:
<https://github.com/navindalmia/expense-manager/issues?q=is%3Aissue+label%3Aknown-issue>

## For maintainers

Setup, rollback and the release flow are in [`docs/staging-environment.md`](../staging-environment.md). Release notes for each staging build are created automatically on every push to `staging`; add a **Tester notes** section to your pull request so it can be copied into the release.
