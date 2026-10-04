# Features

What the Expense Manager app can do, for anyone opening the repo or the app. This page covers the Theme, Label, and title-suggestion features; it is not (yet) a full inventory of every feature.

> Screenshots: each section has a `docs/screenshots/<name>.png` slot. Capture them from a local Android emulator run (see `maestro-flows/visual/` for the emulator setup) and add them next to the matching section. They are intentionally not generated in CI.

## Categories, Labels and Themes in one minute

Every expense can carry up to three kinds of tags. Tap the small **i** next to Category, Label, or Theme on any form to see this explanation in the app.

| Tag | What it is | Example |
| --- | --- | --- |
| Category | What kind of spending it is. Every expense has exactly one. | Food, Travel |
| Label | An optional tag you invent, usable in any group, so related spending can be seen together. | "Liverpool trip" |
| Theme | Links groups and expenses that belong together over time. | "Monthly Expense" |

## Manage Themes

Open **Themes** from the top of the home screen to see every theme you have, with how many groups and expenses use it. You can rename a theme, disable one you no longer need, and enable it again later with one tap. Disabled themes stay in this list (dimmed, tagged "Disabled") but disappear from pickers; existing expenses keep their tag. You can still rename a disabled theme. If you enable a theme whose name is now used by another active theme, you will see a message and nothing changes.

Creating a theme with the same name as one you disabled brings the old one back instead of making a duplicate.

Screenshot: `docs/screenshots/manage-themes.png` (to be captured)

## Manage Labels

On **Manage Labels**, each label shows its total. Disable a label with one tap (no confirmation) and it stays in the list, dimmed and tagged "Disabled", with an **Enable** button to bring it back. Disabled labels are hidden from pickers.

## Rename Labels

On **Manage Labels**, tap **Edit** on a label to rename it in a small dialog. If another label already has that name you will see a message in the dialog and nothing changes, so two different labels are never merged by accident.

Screenshot: `docs/screenshots/rename-label.png` (to be captured)

## Tag an expense with a Theme

When you add or edit an expense you can pick a Theme, just like a Label. Type a new name in the picker to create one on the spot; it is selected immediately. Themes are optional.

Screenshot: `docs/screenshots/expense-theme-picker.png` (to be captured)

## Smarter title suggestions

When you start typing a title for a new expense, the app suggests matching past expenses and fills in amount, category, and split for you when you pick one.

- Each distinct past title appears once, using your most recent expense with that title.
- Suggestions appear in a small scrollable list under the title field, so the form never jumps around.
- A shared everyday word such as "to" or "the" alone no longer produces unrelated suggestions.

Screenshot: `docs/screenshots/title-suggestions.png` (to be captured)

## Pickers stay usable with the keyboard open

The Category, Label, and Theme pickers keep their search box visible above the on-screen keyboard while you type.

Screenshot: `docs/screenshots/picker-with-keyboard.png` (to be captured)
