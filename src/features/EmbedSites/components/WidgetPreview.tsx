import type { CSSProperties } from "react";
import { paletteToCssVars, type WidgetTheme } from "../themes";

/**
 * Static, non-interactive preview of the embedded chat widget rendered in a
 * given theme. Mirrors the live widget's structure (api-velocity
 * `public-chat/widget/ui.ts`) — header with robot icon + "AI Agent", an AI
 * greeting/answer bubble, a source chip, the ask input, and the
 * "Powered by Velocity" footer — styled via the same `--vw-*` custom
 * properties the real widget uses. Illustrative only: the controls are not
 * real inputs, and the whole mock is exposed to assistive tech as a single
 * labelled image.
 */

function RobotIcon({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="3.5" x2="12" y2="7" />
      <circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none" />
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <circle cx="9.5" cy="13" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

type Props = {
  theme: WidgetTheme;
};

const bubbleStyle: CSSProperties = {
  background: "var(--vw-ai-bubble-bg)",
  color: "var(--vw-ai-bubble-text)",
  border: "var(--vw-border-width) solid var(--vw-border)",
  borderRadius: "var(--vw-radius)",
  padding: "8px 12px",
  alignSelf: "flex-start",
  maxWidth: "85%",
  fontSize: "13px",
};

export function WidgetPreview({ theme }: Props) {
  const rootStyle = {
    ...paletteToCssVars(theme.palette),
    fontFamily: "system-ui, sans-serif",
  } as CSSProperties;

  return (
    <div
      role="img"
      aria-label={`${theme.label} theme preview`}
      style={rootStyle}
      className="select-none"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "320px",
          height: "420px",
          background: "var(--vw-surface)",
          color: "var(--vw-text)",
          border: "var(--vw-border-width) solid var(--vw-border)",
          borderRadius: "var(--vw-radius)",
          boxShadow: "var(--vw-shadow)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--vw-header-bg)",
            color: "var(--vw-header-text)",
            padding: "12px 16px",
            fontWeight: 600,
            borderBottom: "var(--vw-border-width) solid var(--vw-border)",
          }}
        >
          <RobotIcon size={20} />
          <span>AI Agent</span>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={bubbleStyle}>Hi! Ask me anything about this site.</div>
          <div style={bubbleStyle}>Hello! How can I assist you today?</div>
          <div
            style={{
              border: "var(--vw-border-width) solid var(--vw-border)",
              borderRadius: "999px",
              padding: "3px 10px",
              fontSize: "12px",
              color: "var(--vw-text)",
              alignSelf: "flex-start",
            }}
          >
            Pricing Guide · Confluence
          </div>
        </div>

        {/* Input row (illustrative, non-interactive) */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "12px 16px",
            borderTop: "var(--vw-border-width) solid var(--vw-border)",
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "8px 10px",
              background: "var(--vw-input-bg)",
              color: "var(--vw-muted)",
              border: "var(--vw-border-width) solid var(--vw-border)",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          >
            Ask a question…
          </div>
          <div
            style={{
              background: "var(--vw-launcher-bg)",
              color: "var(--vw-launcher-text)",
              border: "var(--vw-border-width) solid var(--vw-border)",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "13px",
            }}
          >
            Send
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 16px 12px",
            textAlign: "center",
            color: "var(--vw-muted)",
            fontSize: "11px",
          }}
        >
          Powered by{" "}
          <strong style={{ color: "var(--vw-text)", fontWeight: 700 }}>
            Velocity
          </strong>
        </div>
      </div>
    </div>
  );
}
