"use client";

// Reusable centered modal (Overlay + Panel). Distinct from InvoiceDrawer's
// slide-in-from-the-right pattern - a centered modal reads better for a form the
// operator fills out, and this keeps InvoiceDrawer's working code untouched.

import styled, { keyframes } from "styled-components";

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const popIn = keyframes`from { transform: scale(0.97); opacity: 0; } to { transform: scale(1); opacity: 1; }`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(8, 11, 15, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: ${fadeIn} 0.15s ease;
  z-index: 50;
`;

const Panel = styled.div`
  width: min(520px, 100%);
  max-height: min(640px, 90vh);
  overflow-y: auto;
  background: ${({ theme }) => theme.bg};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  animation: ${popIn} 0.15s ease;
`;

const Head = styled.div`
  padding: 20px 22px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  .title {
    font-size: 16px;
    font-weight: 700;
  }
`;

const Close = styled.button`
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  border-radius: 9px;
  width: 30px;
  height: 30px;
  font-size: 15px;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
`;

const Body = styled.div`
  padding: 20px 22px 22px;
`;

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function ModalShell({ title, onClose, children }: Props) {
  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Head>
          <span className="title">{title}</span>
          <Close onClick={onClose} aria-label="Close">
            ✕
          </Close>
        </Head>
        <Body>{children}</Body>
      </Panel>
    </Overlay>
  );
}
