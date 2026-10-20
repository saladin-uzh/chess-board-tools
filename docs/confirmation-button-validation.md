# Confirmation button class compatibility

Verified on 2026-10-20 against a pending move in the authenticated Chess.com
Live Chess interface using the in-app browser. The panel still uses
`div.confirm-move-buttons`, but its buttons now use classes such as
`cc-button-primary_5a36b5a` and `cc-button-secondary_5a36b5a`.

The old confirmation selector matched zero elements. The updated selector
matched exactly one element with `aria-label="Submit Move"`. Excluding the
updated primary selector from the panel's button candidates left only the
element with `aria-label="Cancel Move"`. The confirmation button was visible,
enabled, and had pointer events enabled. This was read-only DOM validation;
the pending move was not submitted or cancelled by the agent.

## Local regression checks

- `node --test tests/*.test.cjs`: 99 tests pass.
- `node --check` for every top-level JavaScript file and `git diff --check` pass.
- Serve the repository over HTTP and open `tests/confirmation-buttons.html`.
  Its 16 checks exercise the real `settings.js` and `content.js` against a
  browser DOM: legacy and suffixed primary classes in different positions,
  different suffixes, confirmation/cancellation, unrelated buttons, lookalike
  classes, disabled/hidden buttons, and the observed Live Chess button order.

The browser fixture reproduces Space failing and Escape misidentifying a
suffixed primary button as cancellation with the old implementation. The
updated implementation passes the fixture.

Physical shortcuts in the installed Safari extension have not been tested.
The Safari installation and its checkout were not changed or reloaded.
