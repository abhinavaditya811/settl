"use client";

// Decides, for the whole authenticated dashboard, whether to show the real
// board or the post-login zero-state. One gate in the layout covers every
// /dashboard route. Until the operator opts into the demo (or, later, has their
// own data), every view is the zero-state.

import { useDemo } from "@/lib/DemoContext";
import ZeroState from "@/components/zero/ZeroState";

export default function DashboardGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { demoEnabled, ready } = useDemo();

  // Wait for localStorage to be read so a returning demo user does not flash
  // the zero-state before the board appears.
  if (!ready) return null;
  if (!demoEnabled) return <ZeroState />;
  return <>{children}</>;
}
