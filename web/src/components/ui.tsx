"use client";

// Small shared primitives so each page stays minimal: a page header with a
// refresh action, plus loading / error / empty states and a base Card.

import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";

export const Card = styled.div`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 14px;
  box-shadow: ${({ theme }) => theme.shadow};
`;

export const Muted = styled.p`
  color: ${({ theme }) => theme.textMuted};
  font-size: 13.5px;
  line-height: 1.55;
`;

const HeaderRow = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 26px;
  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  p {
    margin: 4px 0 0;
    font-size: 13.5px;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Refresh = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border-radius: 9px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }
`;

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { refresh, refreshing } = useBoard();
  return (
    <HeaderRow>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <Refresh onClick={() => refresh(true)} disabled={refreshing}>
        <span aria-hidden>↻</span>
        {refreshing ? "Re-running…" : "Re-run engine"}
      </Refresh>
    </HeaderRow>
  );
}

const Centered = styled.div`
  padding: 70px 0;
  text-align: center;
  color: ${({ theme }) => theme.textMuted};
  font-size: 14px;
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: ${({ theme }) => theme.surfaceAlt};
    padding: 2px 6px;
    border-radius: 6px;
  }
`;

export function Loading({ what = "data" }: { what?: string }) {
  return <Centered>Loading {what}…</Centered>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Centered>
      Couldn’t reach the engine API.
      <br />
      {message}
      <br />
      <br />
      Start it with <code>uvicorn settl.api.main:app --port 8000</code>
    </Centered>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <Centered>{text}</Centered>;
}
