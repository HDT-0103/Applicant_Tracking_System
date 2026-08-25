"use client";

import React from "react";
import { D } from "../lib/shared";
import { AppHeader } from "./AppHeader";
import { LeftSidebar } from "./LeftSidebar";

/**
 * The chrome every signed-in screen sits inside: header, sidebar, content.
 *
 * Seven pages each rebuilt this by hand, which meant seven chances to get the
 * overflow rules slightly different — and they had. Owning it in one place also
 * gives the responsive rules a single home; scattered across seven files they
 * would never stay consistent.
 */

/** Below this width the sidebar rail is hidden and content takes the full row. */
export const COMPACT_BREAKPOINT = 900;

export interface AppShellProps {
  children: React.ReactNode;
  /** Passed through to the header, which shows it as context. */
  candidateName?: string;
  /**
   * Screens that manage their own scrolling (split panes, embedded PDF) opt
   * out. The default gives the content area a single vertical scroll.
   */
  scroll?: boolean;
  /** Padding around the content. `false` for edge-to-edge layouts. */
  padded?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  candidateName,
  scroll = true,
  padded = true,
}) => {
  const compact = useIsCompact();

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <AppHeader candidateName={candidateName} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* The rail is 56px of permanent layout cost. On a narrow screen that
            is a real fraction of the width, and the expanded panel would cover
            most of the content anyway, so it is dropped entirely. */}
        {!compact && <LeftSidebar />}

        <main
          // `minWidth: 0` stops a wide child (a table, a long unbroken string)
          // from forcing the flex item wider than the viewport, which is what
          // produces horizontal page scroll.
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: scroll ? "auto" : "hidden",
            overflowX: "hidden",
            background: D.bg,
            padding: padded ? (compact ? "20px 16px" : "32px 40px") : 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

/**
 * Tracks whether the viewport is below the compact breakpoint.
 *
 * Starts `false` and corrects after mount rather than reading `window` during
 * render: the server has no viewport, and a server/client mismatch on the first
 * paint is a hydration error.
 */
export function useIsCompact(breakpoint: number = COMPACT_BREAKPOINT): boolean {
  const [compact, setCompact] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [breakpoint]);

  return compact;
}
