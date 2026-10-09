# Popup system appearance validation

The popup uses a light palette by default and a dark palette inside
`prefers-color-scheme: dark`. Each palette sets `color-scheme` for native controls.
No script or stored theme preference is needed when appearance changes.

## Automated and visual checks performed

- `node --test tests/*.test.cjs`: all three existing test files passed.
- `git diff --check`: passed.
- Headless system Chromium, with the real popup HTML/scripts and a storage API
  mock: light → dark → light media emulation updated the open page's palette.
- Native keyboard events: Tab moved between selects, arrows changed selects and
  the opacity slider, and Space toggled the keyboard checkbox in each appearance.
  Mock storage saved settings and restored them on page reload, including opacity.
- Inspected screenshots in both appearances with checked/unchecked checkboxes,
  the slider, focused select, disabled select, helper text, and error/success text.
  Layout width remains 360px; spacing and type sizes are unchanged.
- WCAG relative-luminance calculations for palette colors: minimum normal text
  contrast against the surface is 5.95:1 (light), 8.72:1 (dark). Disabled select
  text also exceeds 4.5:1. Borders, focus and accent against the surface have a
  minimum of 3.66:1 (light), 5.16:1 (dark). Native control internals are rendered
  by the browser and still require the platform checks below.

## Manual release checks still required

Chrome and Safari extension popup checks on their actual platforms were not
available in this Linux/headless environment. Chromium emulation and mocked
storage do not substitute for Safari or actual extension storage integration.

For each browser, load the extension and check both system appearances:

1. Open the popup, then change system appearance while it stays open. Check the
   header, labels, descriptions, dividers, and all controls for immediate updates.
2. Use Tab/Shift+Tab through every control. Check visible focus, use arrows in
   selects/sliders and Space on checkboxes. Inspect the expanded native select
   menu, selected option, checked/unchecked boxes, and slider minimum/maximum.
3. Inspect disabled controls while settings load/save, plus success/error states
   (including failed storage access). Verify status announcements with a screen
   reader and ensure no text or controls become unreadable.
4. Change hotkeys, fog enable/opacity/perspective, keyboard control and ticking;
   close/reopen the popup and confirm values restore. Check fog and keyboard
   behavior on the board and confirm the page appearance remains unchanged.
