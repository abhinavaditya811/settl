// Layout for the authenticated dashboard. Access is gated at the edge by
// middleware.ts — a request without a valid session never reaches this layout.
// The dashboard page has its own self-contained sidebar and tab navigation,
// so this layout only provides data-layer context (DemoProvider, BoardProvider).

import DemoProvider from "@/lib/DemoContext";
import BoardProvider from "@/lib/BoardContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <BoardProvider>
        {children}
      </BoardProvider>
    </DemoProvider>
  );
}

