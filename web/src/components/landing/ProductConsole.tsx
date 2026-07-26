"use client";

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { LedgerIcon } from "./LedgerIcons";
import ProductConsolePreview, {
  CONSOLE_DATA,
  CONSOLE_TABS,
  type ConsoleTabKey,
} from "./ProductConsolePreview";
import { playLandingTone } from "./useLandingAudio";
import { setLandingHash } from "./LandingChrome";

const dark = "#111214";
const paper = "#f1ecdf";
const violet = "#7466f2";
const mint = "#76d9aa";
const ease = [0.22, 0.7, 0.2, 1] as const;
const pulse = keyframes`0%,100%{opacity:.5}50%{opacity:1}`;

const Product = styled.section`
  background: ${paper};
  color: ${dark};
  padding: 130px 0 110px;
  overflow: hidden;
  position: relative;
`;
const ProductMark = styled.div`
  position: absolute;
  right: -2vw;
  top: 24px;
  font: 600 22vw / 0.8 var(--font-display);
  letter-spacing: -0.08em;
  color: rgba(17, 18, 20, 0.03);
  pointer-events: none;
`;
const ProductHead = styled.div`
  width: min(1180px, calc(100% - 52px));
  margin: auto;
  position: relative;
  z-index: 1;
  .product-kicker {
    font: 600 9px var(--font-mono);
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: ${violet};
    margin-bottom: 18px;
  }
  h2 {
    font: 600 clamp(48px, 7vw, 96px) / 0.88 var(--font-display);
    letter-spacing: -0.07em;
    margin: 0;
    max-width: 12ch;
  }
  @media (max-width: 760px) {
    width: calc(100% - 34px);
  }
`;
const PrincipleStrip = styled.div`
  width: min(1180px, calc(100% - 52px));
  margin: 42px auto 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid #cfc7ba;
  border-radius: 18px;
  overflow: hidden;
  background: #faf6ec;
  .cell {
    padding: 22px 24px;
    border-right: 1px solid #cfc7ba;
    min-height: 126px;
  }
  .cell:last-child {
    border: 0;
  }
  .ico {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: ${violet};
    background: #ebe6ff;
    margin-bottom: 14px;
  }
  .ico svg {
    width: 17px;
  }
  .label {
    font: 600 9px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${violet};
  }
  .copy {
    font: 500 14px / 1.45 var(--font-display);
    margin-top: 8px;
    letter-spacing: -0.02em;
  }
  @media (max-width: 820px) {
    width: calc(100% - 34px);
    grid-template-columns: 1fr;
    .cell {
      border-right: 0;
      border-bottom: 1px solid #cfc7ba;
    }
  }
`;
const Console = styled.div`
  width: min(1180px, calc(100% - 52px));
  margin: 54px auto 0;
  border: 1px solid #2a2d33;
  border-radius: 18px;
  background: #0f1114;
  color: #e5e7eb;
  box-shadow: 0 50px 120px rgba(17, 18, 20, 0.28);
  overflow: hidden;
  @media (max-width: 760px) {
    width: calc(100% - 34px);
  }
`;
const ConsoleTop = styled.div`
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #24272d;
  font: 500 10px var(--font-body);
  color: #8b9099;
  .live {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${mint};
    animation: ${pulse} 1.6s ease infinite;
  }
  .pill {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid #343842;
    font: 600 8px var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
`;
const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: 212px 1fr;
  min-height: 540px;
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;
const Side = styled.div`
  padding: 16px 12px;
  border-right: 1px solid #24272d;
  background: #121418;
  @media (max-width: 760px) {
    display: flex;
    overflow: auto;
    border-right: 0;
    border-bottom: 1px solid #24272d;
    padding-bottom: 10px;
  }
`;
const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 16px;
  .logo {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: ${violet};
    display: grid;
    place-items: center;
    color: #fff;
  }
  .logo svg {
    width: 14px;
  }
  .name {
    font: 700 14px var(--font-body);
  }
  .beta {
    font: 700 8px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 5px;
    color: ${violet};
    background: #1c1f27;
    border: 1px solid #343842;
  }
  @media (max-width: 760px) {
    display: none;
  }
`;
const Tab = styled.button<{ $on: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 0;
  border-radius: 9px;
  margin-bottom: 4px;
  cursor: pointer;
  text-align: left;
  background: ${({ $on }) => ($on ? "#1c1f27" : "transparent")};
  color: ${({ $on }) => ($on ? violet : "#8b9099")};
  font: ${({ $on }) => ($on ? 700 : 400)} 13px var(--font-body);
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
  &:hover {
    background: #1c1f27;
    color: #e5e7eb;
    transform: translateX(2px);
  }
  .badge {
    font: 700 10px var(--font-mono);
    padding: 1px 7px;
    border-radius: 999px;
    color: #f0b45a;
    background: rgba(240, 180, 90, 0.14);
  }
  @media (max-width: 760px) {
    width: auto;
    min-width: 120px;
    margin: 0 4px 0 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
`;
const View = styled.div`
  padding: 22px 24px 28px;
  background:
    radial-gradient(480px 220px at 100% 0%, rgba(116, 102, 242, 0.12), transparent 60%),
    #0f1114;
  @media (max-width: 600px) {
    padding: 18px 14px;
  }
  .label {
    font: 600 10px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${violet};
  }
  h3 {
    font: 700 28px var(--font-display);
    letter-spacing: -0.04em;
    margin: 8px 0 6px;
    color: #f3f4f6;
  }
  .desc {
    font: 400 13px / 1.55 var(--font-body);
    color: #8b9099;
    max-width: 54ch;
  }
  .demo {
    margin-top: 10px;
    font: 600 9px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6f747c;
  }
`;
const Metrics = styled.div`
  width: min(1180px, calc(100% - 52px)); margin: 70px auto 0; display: grid; grid-template-columns: repeat(3, 1fr);
  border: 1px solid #cfc7ba; border-radius: 18px; overflow: hidden; background: #faf6ec;
  .metric { padding: 28px 24px; border-right: 1px solid #cfc7ba; }
  .metric:last-child { border: 0; }
  .big { font: 600 48px var(--font-display); letter-spacing: -0.05em; }
  .small { font: 500 9px var(--font-mono); text-transform: uppercase; color: #777067; margin-top: 5px; }
  @media (max-width: 650px) {
    width: calc(100% - 34px); grid-template-columns: 1fr;
    .metric { border-right: 0; border-bottom: 1px solid #cfc7ba; }
  }
`;

export default function ProductConsole() {
  const [tab, setTab] = useState<ConsoleTabKey>("overview");
  const data = CONSOLE_DATA[tab];

  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<{ tab: ConsoleTabKey }>).detail?.tab;
      if (next && CONSOLE_DATA[next]) setTab(next);
    };
    window.addEventListener("settl:console-tab", onTab);
    return () => window.removeEventListener("settl:console-tab", onTab);
  }, []);

  const select = (key: ConsoleTabKey) => {
    setTab(key);
    setLandingHash(key);
    playLandingTone("click");
  };

  return (
    <Product id="console">
      <ProductMark>PROOF</ProductMark>
      <ProductHead>
        <div className="product-kicker">one engine · four windows</div>
        <h2>The dashboard is the receipt, not the brain.</h2>
      </ProductHead>
      <PrincipleStrip>
        <div className="cell">
          <div className="ico"><LedgerIcon name="strategy" /></div>
          <div className="label">Engine</div>
          <div className="copy">Chooses timing, tone, and channel for every invoice.</div>
        </div>
        <div className="cell">
          <div className="ico"><LedgerIcon name="gate" /></div>
          <div className="label">Control</div>
          <div className="copy">You approve first contact. Risky drafts never leave.</div>
        </div>
        <div className="cell">
          <div className="ico"><LedgerIcon name="reconcile" /></div>
          <div className="label">Proof</div>
          <div className="copy">Every dollar and decision is logged with a reason.</div>
        </div>
      </PrincipleStrip>
      <Console>
        <ConsoleTop>
          <span className="live"><span className="dot" />Demo workspace · synthetic data</span>
          <span className="pill">3 invoices · 3 customers</span>
        </ConsoleTop>
        <ProductGrid>
          <Side role="tablist" aria-label="Board tabs">
            <Brand>
              <span className="logo" aria-hidden="true"><LedgerIcon name="reconcile" /></span>
              <span className="name">Settl</span>
              <span className="beta">Pre-beta</span>
            </Brand>
            {CONSOLE_TABS.map((item) => (
              <Tab
                key={item.key}
                role="tab"
                aria-selected={item.key === tab}
                $on={item.key === tab}
                onClick={() => select(item.key)}
              >
                {item.label}
                {"badge" in item && item.badge ? <span className="badge">{item.badge}</span> : null}
              </Tab>
            ))}
          </Side>
          <View>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease }}
              >
                <div className="label">{data.label}</div>
                <h3>{data.title}</h3>
                <div className="desc">{data.desc}</div>
                <div className="demo">demo data · not revenue</div>
                <ProductConsolePreview tab={tab} />
              </motion.div>
            </AnimatePresence>
          </View>
        </ProductGrid>
      </Console>
      <Metrics>
        <div className="metric"><div className="big">31 → 19</div><div className="small">days to payment</div></div>
        <div className="metric"><div className="big">~14 hrs</div><div className="small">manual chasing avoided</div></div>
        <div className="metric"><div className="big">0</div><div className="small">unsafe sends</div></div>
      </Metrics>
    </Product>
  );
}
