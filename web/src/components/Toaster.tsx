"use client";

import styled, { keyframes } from "styled-components";
import { useBoard } from "@/lib/BoardContext";

const slideUp = keyframes`from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; }`;

const Toast = styled.div<{ $tone: "ok" | "err" }>`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 60;
  padding: 13px 18px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 600;
  max-width: 380px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
  animation: ${slideUp} 0.18s ease;
  color: ${({ theme, $tone }) =>
    $tone === "ok" ? theme.status.sent.fg : theme.status.escalated.fg};
  background: ${({ theme, $tone }) =>
    $tone === "ok" ? theme.status.sent.bg : theme.status.escalated.bg};
  border: 1px solid ${({ theme }) => theme.border};
`;

export default function Toaster() {
  const { toast } = useBoard();
  if (!toast) return null;
  return <Toast $tone={toast.tone}>{toast.text}</Toast>;
}
