import styled, { keyframes } from "styled-components";

const rise = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const Rise = styled.div<{ $delay?: number }>`
  animation: ${rise} 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: ${({ $delay = 0 }) => $delay}ms;
`;

export const Panel = styled.section`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 20px;
  overflow: hidden;
`;

export const PanelHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 20px 22px 0;
  .copy {
    min-width: 0;
  }
  .title {
    display: block;
    font-family: var(--font-display, inherit);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: ${({ theme }) => theme.text};
  }
  .hint {
    display: block;
    margin-top: 4px;
    font-size: 13.5px;
    line-height: 1.4;
    color: ${({ theme }) => theme.textMuted};
  }
`;

export const GhostLink = styled.button`
  flex-shrink: 0;
  margin-top: 1px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surfaceAlt};
  padding: 7px 11px;
  border-radius: 9px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.text};
  transition: background 0.15s ease;
  &:hover {
    background: ${({ theme }) => theme.surface};
  }
`;
