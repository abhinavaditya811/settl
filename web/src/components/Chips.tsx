"use client";

import styled from "styled-components";

const Row = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Chip = styled.button<{ $active: boolean }>`
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.accent : theme.border)};
  color: ${({ theme, $active }) => ($active ? theme.accentText : theme.textMuted)};
  background: ${({ theme, $active }) => ($active ? theme.accent : theme.surface)};
  transition: all 0.12s ease;
  &:hover {
    border-color: ${({ theme }) => theme.accent};
  }
  .count {
    opacity: 0.7;
    margin-left: 5px;
  }
`;

export interface ChipOption {
  key: string;
  label: string;
  count?: number;
}

export default function Chips({
  options,
  active,
  onPick,
}: {
  options: ChipOption[];
  active: string;
  onPick: (key: string) => void;
}) {
  return (
    <Row>
      {options.map((o) => (
        <Chip key={o.key} $active={o.key === active} onClick={() => onPick(o.key)}>
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </Chip>
      ))}
    </Row>
  );
}
