import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

/**
 * Rounded-border box drawing shared by this extension's overlays.
 *
 * Both the cheatsheet and the rename prompt draw the same frame, so it lives in
 * one place — the modals stay visually identical by construction rather than by
 * convention.
 */
export type BoxRenderer = {
  /** Width available to row content, i.e. the box width minus both borders. */
  readonly innerWidth: number;
  top(): string;
  bottom(): string;
  /** A content row, padded to the box width. Over-long text is ellipsized. */
  row(text?: string): string;
};

export function createBoxRenderer(theme: Theme, boxWidth: number): BoxRenderer {
  const innerWidth = Math.max(0, boxWidth - 2);
  const border = (text: string) => theme.fg("border", text);

  return {
    innerWidth,
    top: () => border(`╭${"─".repeat(innerWidth)}╮`),
    bottom: () => border(`╰${"─".repeat(innerWidth)}╯`),
    row: (text = "") => {
      const content = truncateToWidth(` ${text}`, innerWidth, "…");
      // visibleWidth ignores ANSI and the zero-width cursor marker, so an
      // inline cursor does not throw the padding off.
      const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(content)));
      return `${border("│")}${content}${padding}${border("│")}`;
    },
  };
}
