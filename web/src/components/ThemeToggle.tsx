"use client";

import styled from "styled-components";
import { useThemeMode } from "@/lib/ThemeContext";

const Button = styled.button`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: ${({ theme }) => theme.textMuted};
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
    color: ${({ theme }) => theme.text};
  }
`;

export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  const dark = mode === "dark";
  return (
    <Button
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      <span aria-hidden>{dark ? "☀" : "☾"}</span>
    </Button>
  );
}
