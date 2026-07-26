"use client";

import SafetyGate from "./SafetyGate";
import PricingClose from "./PricingClose";

export default function RecoveryClose() {
  return (
    <>
      <SafetyGate />
      <PricingClose />
    </>
  );
}
