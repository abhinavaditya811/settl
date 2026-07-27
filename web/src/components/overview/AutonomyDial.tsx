"use client";

import styled from "styled-components";
import {
  AUTONOMY_COPY,
  type AutonomyLevel,
  useAutonomyLevel,
} from "./useAutonomy";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Seg = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
`;

const Opt = styled.button<{ $on?: boolean }>`
  padding: 10px 8px;
  border-radius: 10px;
  border: 1px solid
    ${({ theme, $on }) => ($on ? theme.accent : theme.border)};
  background: ${({ theme, $on }) => ($on ? theme.surfaceAlt : theme.surface)};
  color: ${({ theme, $on }) => ($on ? theme.text : theme.textMuted)};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`;

const Hint = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: ${({ theme }) => theme.textMuted};
`;

const LEVELS: AutonomyLevel[] = ["pilot", "trusted", "handsoff"];

export default function AutonomyDial() {
  const [level, setLevel] = useAutonomyLevel();
  return (
    <Wrap>
      <Seg>
        {LEVELS.map((l) => (
          <Opt key={l} type="button" $on={level === l} onClick={() => setLevel(l)}>
            {AUTONOMY_COPY[l].label}
          </Opt>
        ))}
      </Seg>
      <Hint>{AUTONOMY_COPY[level].hint}</Hint>
    </Wrap>
  );
}
