"use client";

// "Connect Gmail" prompt (SCHEMA.md §7) - lets the operator grant Settl read
// access to their own inbox so debtor replies get picked up automatically,
// without anyone having to hand-craft an OAuth link. Full-page navigation (not
// fetch) for both actions - each is a real redirect through Google's consent
// screen, not an API call.

import { useEffect, useState } from "react";
import styled from "styled-components";

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Connect = styled.a`
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.accent};
  background: transparent;
  color: ${({ theme }) => theme.accent};
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.accent};
    color: ${({ theme }) => theme.accentText};
  }
`;

const Connected = styled.span`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.status.sent.fg};
`;

const Error = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.status.escalated.fg};
`;

// oauth_routes.py's _error_redirect() sends a short code, never a raw message -
// friendly text lives here, one place, easy to extend as new failure modes show up.
const ERROR_MESSAGES: Record<string, string> = {
  expired_link: "That connection link expired - click Connect Gmail to try again.",
  connect_failed: "Couldn't connect Gmail - please try again.",
  not_configured: "Gmail connection isn't available right now.",
};

export default function GmailConnect() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A return trip from Google's consent screen is a full page load, so this
    // effect re-runs on mount either way - no need to watch the URL directly.
    fetch("/api/oauth/gmail-status")
      .then((r) => r.json())
      .then((d) => setConnected(Boolean(d.connected)))
      .catch(() => setConnected(false));

    const code = new URLSearchParams(window.location.search).get("gmail_error");
    if (code) {
      setError(ERROR_MESSAGES[code] ?? "Couldn't connect Gmail - please try again.");
      // Don't leave the error in the URL - a refresh shouldn't re-show it.
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail_error");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  if (connected === null) return null;

  return (
    <Wrap>
      {connected ? (
        <Connected>✓ Gmail connected</Connected>
      ) : (
        <Connect href="/api/oauth/connect-gmail">Connect Gmail</Connect>
      )}
      {error && <Error>{error}</Error>}
    </Wrap>
  );
}
