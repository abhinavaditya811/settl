"use client";

import styled from "styled-components";
import { useThemeMode } from "@/lib/ThemeContext";

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.05s ease;

  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
    border-color: ${({ theme }) => theme.accent};
  }
  &:active {
    transform: translateY(1px);
  }
`;

export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  const dark = mode === "dark";
  return (
    <Button onClick={toggle} aria-label="Toggle light or dark theme">
      <span aria-hidden>{dark ? "☀️" : "🌙"}</span>
      {dark ? "Light" : "Dark"}
    </Button>
  );
}
