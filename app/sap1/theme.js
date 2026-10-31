// Color palettes for the SAP-1 page. Every color the visualizer draws comes from a palette, so a
// second look can be added here (same keys) and handed to the visualizer instead.

// Dark "blackboard" take on the textbook diagrams: light chalk lines, red for what is active.
export const TEXTBOOK = {
  scheme: "dark", // CSS color-scheme (scrollbars, form controls)
  bg: "#0d0f12", // page background
  block: "#14171c", // block fill
  blockAlt: "#191d23", // switch fill
  hover: "#222730", // hovered block fill, idle bus fill
  hoverStrong: "#2c323c", // hovered bus fill
  ledOff: "#1f2329", // unlit LED
  ink: "#e5e7eb", // lines and main text
  soft: "#c4c8cf", // secondary text
  muted: "#9ca3af", // labels and notes
  faint: "#6b7280", // de-emphasised text
  frame: "#4b5563", // dashed groups, outer borders
  rule: "#262b33", // dividers in the side panel
  disabled: "#3a404a", // disabled buttons
  accent: "#ff4d4d", // active signals and blocks
  accentTint: "#3a1214", // fill behind active blocks and rows
  onAccent: "#0d0f12", // text on an accent fill
};

// The palette as CSS custom properties (--sap-accent-tint, ...) for the HTML parts of the page.
export function cssVars(pal) {
  return Object.fromEntries(
    Object.entries(pal).map(([k, v]) => [`--sap-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v])
  );
}
