// Layout for the authenticated dashboard. Everything under /dashboard gets the
// demo-mode flag, the engine context (BoardProvider), and the app chrome
// (Shell - sidebar, toaster). Public pages (landing, /signin) deliberately do
// NOT mount these, so they neither render the sidebar nor hit the engine API.
//
// DemoProvider wraps BoardProvider so the board only fetches once the operator
// opts into the demo. DashboardGate then shows the zero-state until then.
//
// Access is gated at the edge by middleware.ts - a request without a valid
// session never reaches this layout.

import DemoProvider from "@/lib/DemoContext";
import BoardProvider from "@/lib/BoardContext";
import Shell from "@/components/shell/Shell";
import DashboardGate from "@/components/dashboard/DashboardGate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <BoardProvider>
        <Shell>
          <DashboardGate>{children}</DashboardGate>
        </Shell>
      </BoardProvider>
    </DemoProvider>
  );
}
