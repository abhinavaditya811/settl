import styled from "styled-components";

export const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 52px;
`;

export const Head = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  h1 {
    margin: 0;
    font-family: var(--font-display, inherit);
    font-size: clamp(26px, 2.6vw, 32px);
    font-weight: 600;
    letter-spacing: -0.045em;
  }
  p {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 1.4;
    color: ${({ theme }) => theme.textMuted};
    max-width: 48ch;
  }
`;

export const HeadBtns = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
`;

export const AddBtn = styled.button<{ $primary?: boolean }>`
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 13px;
  border-radius: 9px;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid
    ${({ theme, $primary }) => ($primary ? theme.accent : theme.border)};
  background: ${({ theme, $primary }) =>
    $primary ? theme.accent : theme.surface};
  color: ${({ theme, $primary }) =>
    $primary ? theme.accentText : theme.text};
  &:hover {
    opacity: 0.92;
  }
`;

export const Search = styled.input`
  width: 100%;
  max-width: 360px;
  height: 38px;
  padding: 0 13px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  font: inherit;
  font-size: 13.5px;
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.accent};
  }
  &::placeholder {
    color: ${({ theme }) => theme.textMuted};
  }
`;

export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

export const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

export const SortGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  .label {
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.textMuted};
    margin-right: 2px;
  }
`;

export const Filter = styled.button<{ $on?: boolean }>`
  padding: 8px 13px;
  border-radius: 999px;
  border: 1px solid
    ${({ theme, $on }) => ($on ? theme.accent : theme.border)};
  background: ${({ theme, $on }) => ($on ? theme.surfaceAlt : theme.surface)};
  color: ${({ theme, $on }) => ($on ? theme.text : theme.textMuted)};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
  &:hover {
    transform: translateY(-1px);
  }
`;

export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const Empty = styled.div`
  text-align: center;
  padding: 56px 20px;
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  .t {
    font-family: var(--font-display, inherit);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }
  .s {
    margin: 8px auto 0;
    max-width: 40ch;
    font-size: 14px;
    line-height: 1.5;
    color: ${({ theme }) => theme.textMuted};
  }
`;

export const Keys = styled.div`
  position: sticky;
  bottom: 12px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(22,27,34,0.92)" : "rgba(255,255,255,0.92)"};
  backdrop-filter: blur(8px);
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
  kbd {
    display: inline-block;
    min-width: 1.4em;
    padding: 2px 6px;
    margin-right: 4px;
    border-radius: 5px;
    border: 1px solid ${({ theme }) => theme.border};
    background: ${({ theme }) => theme.surfaceAlt};
    font-size: 11px;
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    text-align: center;
  }
`;
