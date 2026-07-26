"use client";

import type { ReactNode, SVGProps } from "react";

export type LedgerIconName =
  | "invoice"
  | "strategy"
  | "draft"
  | "gate"
  | "send"
  | "reconcile"
  | "phone"
  | "arrow";

type Props = SVGProps<SVGSVGElement> & { name: LedgerIconName };

const paths: Record<LedgerIconName, ReactNode> = {
  invoice: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9.5 12h5M9.5 15.5h5" />
    </>
  ),
  strategy: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.8 9.2-1.7 4-4 1.7 1.7-4z" />
    </>
  ),
  draft: (
    <>
      <path d="M5 19h3l10-10-3-3L5 16zM13.5 7.5l3 3M5 12V5h7" />
      <path d="M11 19h8v-8" />
    </>
  ),
  gate: (
    <>
      <path d="M12 3.5 19 6v5.3c0 4.5-2.8 7.6-7 9.2-4.2-1.6-7-4.7-7-9.2V6z" />
      <path d="m8.7 12 2.1 2.1 4.7-4.7" />
    </>
  ),
  send: (
    <>
      <path d="m3.5 11 17-7-7 17-2.3-7.2z" />
      <path d="m11.2 13.8 4.2-4.2" />
    </>
  ),
  reconcile: (
    <>
      <path d="M20 7.5A8.5 8.5 0 1 0 20.3 16" />
      <path d="M20 3.5v4h-4M8.5 12l2.2 2.2 4.8-4.8" />
    </>
  ),
  phone: (
    <>
      <path d="M8.2 4.3 5.6 5.7c-.7.4-.9 1.3-.7 2 1.6 5.5 5.9 9.8 11.4 11.4.8.2 1.6-.1 2-.7l1.4-2.6-4.2-2-1.4 1.7a12 12 0 0 1-5.6-5.6l1.7-1.4z" />
      <path d="M14.5 4.5a5 5 0 0 1 5 5M14.5 7.5a2 2 0 0 1 2 2" />
    </>
  ),
  arrow: <path d="M4 12h15M14 7l5 5-5 5" />,
};

export function LedgerIcon({ name, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
