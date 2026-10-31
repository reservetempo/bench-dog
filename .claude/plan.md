# Plan

## Shared context (include in every subagent prompt)

- Next.js 14 app (React 18, Tailwind 3, plain JS/JSX). The SAP-1 page is `/sap1`: `app/sap1/page.jsx` → `app/sap1/Sap1Visualizer.jsx` (diagram, zoom/drill-down via URL hash, controls, info panel), `app/sap1/sap1Parts.js` (part tree: each node has `diagram.blocks`/`wires`/`pins`/`groups` and `children` for drill-down), `app/sap1/sap1Sim.js` (simulator: `initialState`, `derive`, `step`, `signals`, `describe`, `CON_ORDER`, `bin`, `hex`).
- Only change the `/sap1` route; the rest of the site stays as it is.
- User decisions:
  - **Dark only.** No light theme, no theme toggle.
  - **Two modes**, switched by a toggle on the page, remembered in `localStorage` (wrap in try/catch, render fine without it):
    - **Textbook mode**: today's simple block diagram with numbers, drawn light-on-dark (blackboard style). A single accent color for "active".
    - **Game mode** (the default on first visit): a 1970s computer front panel (Altair-8800 style) drawn in SVG. Registers are rows of LEDs, inputs are toggle switches and push buttons that light up when on or pressed. No three.js.
  - **Period-accurate colors only** (what existed in the 1970s): red, amber/yellow, yellow-green and warm incandescent white. No blue, cyan or magenta.
  - **LED color by signal type**: address = amber, data = green, control signals = red, clock/T-state/status lamps = warm incandescent white, output display = red. The bus takes amber when it carries an address (Ep or Ei driving) and green when it carries data.
  - Keep the 0/1 numbers too. LEDs are in addition to the binary/hex text, not a replacement.
  - **Users can program the RAM** with the switches, as in the book: RUN/PROG switch, 4 address switches, 8 data switches, a WRITE button.
  - **Guided tour** (opt-in) for learning: power on → clear → enter a program with the switches → back to RUN → fetch → execute → output → halt.
- Respect `prefers-reduced-motion`. Keep keyboard access (role="button", tabIndex, Enter/Space) for anything clickable. Must work at phone width (the SVG can scroll horizontally inside its frame, as now).
- Checking: launch config `next-dev` in `.claude/launch.json` (`npm run dev`, port 3000), page `http://localhost:3000/sap1`. Don't run `next build` while the dev server is running (they share `.next`); stop the preview first if a build is needed.
- Git: branch `main`. Pull with `git pull --rebase`, push with `git push`.

## Next

11. **Remove /sap1 from this site and link out** (files: delete `app/sap1/`, edit `app/page.jsx`). BLOCKED until the standalone site in `C:\Users\DomPC\Desktop\websites\sap-computer` (see "After Next" below) is built and pushed, and the user has given its public URL. Delete the `app/sap1` folder, change the SAP-1 link on the homepage (`app/page.jsx`) to the new site's URL (opens the external site), and check nothing else imports from `app/sap1`. Check with the `next-dev` preview that the homepage renders and the link points to the new URL.

## After Next (user request, 2026-10-31)

When tasks 1–10 are done, run `/z` in `C:\Users\DomPC\Desktop\websites\sap-computer` (currently an empty folder) to create a standalone SAP-1 website there, moving the finished SAP-1 visualizer over. User's answers:
- Stack: **Vite + React** static site (the SAP-1 code is client-only React; port the Tailwind classes and the `app/sap1/*` files, and replace Next-specific bits such as `metadata`, `next/link` and the "← home" link).
- Git: `git init -b main` and a **new public GitHub repo** `sap-computer` on the `reservetempo` account (via `gh repo create`), pushed from there.
- Extras: an **about/credits footer** crediting Malvino & Brown's *Digital Computer Electronics* and linking back to the main site. No landing section, no deploy config for now.
- Also in the new project: on phones the tour's mission text sits below the diagram, so make the mission card sticky or collapsible near the panel (follow-up from task 10).
- Still for the user to check by eye: animations with the OS reduced-motion setting on, and the zoom/animations at FAST in a visible window. The agents' browser pane was hidden, so they couldn't watch them run.
- Then come back here for task 11 (remove `/sap1`, link the homepage to the new site's URL once the user gives it).

## Done

- Task 1, dark textbook theme: f1cebb0. `/sap1` is dark only; colors come from the `TEXTBOOK` palette in `app/sap1/theme.js` (React context for the SVG, `--sap-*` CSS variables for the HTML).
- Task 2, simulator PROG mode: 036e2ec. Added `prog`, `addrSw`, `dataSw`, `cycles` and `instructions` to the state, plus the helpers `setProg`, `toggleAddrBit`, `toggleDataBit`, `write`, `clear`, `loadExample` and `ramAddr`; the RAM, mux and switch values in the drill-downs follow the mode.
- Task 3, textbook programming controls: c1488cc. Added a RUN/PROG toggle, Clear, Load example, the address/data bit switches and Write. The memory table decodes RAM with `decodeWord` (exported from `sap1Parts.js`), and the controller shows "PROG · clock stopped" in PROG mode.
- Task 4, mode toggle and Game palette: 6d9da66. Added the Game | Textbook toggle (Game is the default, saved as `sap1-mode`), the `GAME` period palette, and `signalType` in `app/sap1/signalTypes.js`; Game mode colors active parts by signal type, and Textbook is unchanged.
- Task 5, Game front panel displays: 19f0409. New `app/sap1/GamePanel.jsx`, an 820×600 SVG front panel with lamps for every register, the bus, CON and T-states, colored by type with the values printed. `SvgText`/`Sig` moved to `app/sap1/sigText.jsx`. Drill-down zooms from the panel section via `partBox()`.
- Task 6, Game panel switches and buttons: 38b99ba. The CONTROLS strip has S1–S7: address and data bat-handle levers with bit lamps, RUN/PROG, lit WRITE, CLEAR/START, SINGLE STEP and LOAD EXAMPLE buttons, MANUAL/AUTO, and a SLOW/MED/FAST clock switch.
- Task 7, drill-down chip styling: 3bc933b. Game-mode drill-downs use the new `app/sap1/gameParts.jsx`: DIP chips, DIP switch banks and push buttons, red LED display, protoboard groups, jumper wires colored by signal type, and screw-head drill markers.
- Task 8a, one clock with a rate setting: 77d9996. `rate` state ("slow"|"med"|"fast") and `export const STEP_MS = { slow: 1200, med: 550, fast: 150 }` in `Sap1Visualizer.jsx`. `GamePanel` gets `rate`, `setRate` and `stepMs`. The toolbar has a Slow/Med/Fast control, and Step is disabled while running.
- Task 8b, front panel animations: 1c903e7. Lamp fades, register-change flashes, a bus glow sweep, a new CLK lamp, HALT breathing, CON flares and springy levers, all timed from `stepMs` and turned off under reduced motion.
- Task 8c, wire pulses: 0d20b61. A dash travels from driver to loader along active wires, once per step (minimum 300 ms): a pale type-color tint with a halo in Game drill-downs, a light-red tint in Textbook. Active chips flare on each T state. Not yet checked with the real reduced-motion setting or watched at FAST in a visible window.
- Task 9a, guided tour logic and panel: 7b0b301. 12 missions, a first-visit card, a Tour button that resumes progress ("Start over" link), and a quest log above the info panel. `clears`/`writes` counters added to the sim. Runs ahead skip done steps; hints for the wrong mode; "Back to the panel" when the user leaves the panel.
- Task 9b, tour spotlight: aca4b54. A `highlight` prop on `GamePanel` draws pulsing warm-white outlines with light dimming elsewhere. `TOUR_BOXES` export, `data-tour-id` on every section and control.
- Task 10, final check and polish: 1e907e7. Renamed `tour.js` to `tourSteps.js`; the diagram SVG is now `role="group"`; hover is cleared on mode switch; focus moves to the SVG after a drill-down or going back up. Phone width, keyboard, reduced-motion CSS and the tour were checked, and `npm run build` is clean.
