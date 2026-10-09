# Thinking timer validation

This PR is stacked on keyboard board control. The timer uses its independent
read-only adapter; fog contexts remain unchanged. No new dependency or
extension permission.

## Automated checks

`node --test tests/*.test.cjs`: 53 passing tests. Added timer coverage includes
10-second deadlines, delayed polling without a backlog, own/opponent turns,
unknown color, analysis, new sessions, game completion, pending confirmation,
dragging, background return, and unavailable/blocked Web Audio. Changed
scripts pass `node --check`; `git diff --check` passes.

## Runtime evidence

In an isolated Chrome for Testing 154 profile, a disposable bot game produced
running Web Audio oscillators about ten seconds apart. No extension audio was
created before interaction with the tab. Instrumentation was removed after
testing.

A background-return bug discovered in the first test was fixed: the first
visible update now consumes elapsed deadlines silently even when it runs
before the visibilitychange listener. Retesting recorded:

- Last visible tick: performance.now() = 43835.9 ms.
- Hidden: 47509.2 ms, one recorded oscillator.
- Visible again: 61564.0 ms, still one recorded oscillator.
- Next scheduled tick: 63836.2 ms, with a running context.

The combined popup fit without visible scrolling or clipped content. Safari
was not modified or reloaded.

## Remaining acceptance checks

Own-turn state in active human live/daily games and their native pending
confirmation prompt still require disposable runtime testing. The automated
pending-confirmation test does not establish the host prompt state. Keep this
PR in draft until these checks and keyboard prerequisite acceptance pass.
v1.1.0 publication additionally requires the user's confirmation after merge.

## Review regressions

- Board replacement at nine seconds retains the original ten-second deadline
  in an integration test using the real turn timer and content controller.
- Missing snapshots consume unavailable deadlines without replay; a verified
  new session starts a fresh clock.
- Pending confirmation preserves time only for the same session and player
  color, including when a stale confirmation control remains visible.
- Deferred resolve and reject of a closed context cannot block reopened audio
  or clear the new context's pending resume flag; the new context emits a tick.
- Trusted mouse pointerdown, touch/pen pointerup, and eligible keydown unlock
  audio only with visible-document transient user activation. Escape,
  modifiers, browser chords, repeats, untrusted events, hidden documents,
  missing activation APIs, and inactive activation are covered by tests.
  Synthetic touch/pen tests do not establish physical-device behavior.

## Runtime retest after review fixes

The revised extension was loaded from the timer worktree into isolated Chrome
for Testing 154 (extension ID fokonkagndapcnjkbmnnbabdhfblbfib). The old test
copies remained disabled; Safari was untouched.

Mouse activation in the disposable bot game produced running oscillators at
65665.8, 75664.8, and 85665.0 ms. After dispatched pagehide/pageshow lifecycle
events closed and restored the controller at 168745.6 ms, a real keyboard
press reactivated audio: ticks occurred at 178747.8, 188746.8, and 198747.1 ms.
This verifies lifecycle handlers with real Web Audio, not a real BFCache
navigation or an actual deferred-resume failure; those races have controlled
Node regression coverage.

The game tab was hidden at 200960.5 ms and returned at 221216.6 ms. Both
visibility records contained fourteen oscillators; there were no hidden or
immediate catch-up ticks. The next tick occurred at 228746.9 ms on the existing
schedule. Instrumentation was restored after the test. Physical touch/pen
hardware was not tested.

## Pending-confirmation enable regression

Enabling ticking or restoring the controller while native confirmation is
already visible starts a new clock despite the tentative opponent-turn FEN.
The visible control is associated with its observed session and player color;
a retained control cannot authorize ticking after either changes, including
across preference toggles. Real-controller tests cover both start paths,
confirmation removal, stale-control polling and a newly displayed control.
This is controlled integration coverage; active human native prompts remain
outside the runtime evidence above.
