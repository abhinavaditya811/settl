"use client";

import { useState } from "react";
import styled, { keyframes } from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { LedgerIcon } from "./LedgerIcons";
import ProductConsolePreview, { CONSOLE_DATA, type ConsoleTabKey } from "./ProductConsolePreview";

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
  border: 1px solid #c6beaf;
  border-radius: 24px;
  background: #fbf7ed;
  box-shadow: 0 50px 120px rgba(47, 39, 25, 0.14);
  overflow: hidden;
  @media (max-width: 760px) {
    width: calc(100% - 34px);
  }
`;
const ConsoleTop = styled.div`
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #d9d1c4;
  font: 500 9px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #777067;
  background: linear-gradient(180deg, #fffdf8, #f7f1e5);
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
`;
const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 520px;
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;
const Tabs = styled.div`
  padding: 14px;
  border-right: 1px solid #d9d1c4;
  background: #f4efe3;
  @media (max-width: 760px) {
    display: flex;
    overflow: auto;
    border-right: 0;
    border-bottom: 1px solid #d9d1c4;
  }
`;
const Tab = styled.button<{ $on: boolean }>`
  position: relative;
  width: 100%;
  padding: 14px 14px 14px 16px;
  border: 0;
  border-radius: 12px;
  background: ${({ $on }) => ($on ? "#fffdf7" : "transparent")};
  color: ${({ $on }) => ($on ? dark : "#777067")};
  text-align: left;
  cursor: pointer;
  margin-bottom: 4px;
  box-shadow: ${({ $on }) => ($on ? "0 10px 24px rgba(61,48,31,.08)" : "none")};
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    background: #fffdf7;
    transform: translateX(2px);
  }
  .l {
    font: 600 13px var(--font-display);
  }
  .s {
    font: 400 10px var(--font-body);
    color: #8a8378;
    margin-top: 3px;
  }
  @media (max-width: 760px) {
    width: auto;
    min-width: 140px;
    margin: 0 4px 0 0;
  }
`;
const Indicator = styled(motion.span)`
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 14px;
  width: 2px;
  background: ${violet};
  border-radius: 2px;
`;
const View = styled.div`
  padding: 34px;
  background:
    radial-gradient(520px 240px at 100% 0%, rgba(116, 102, 242, 0.08), transparent 60%),
    #fffdf7;
  @media (max-width: 600px) {
    padding: 22px 16px;
  }
  .label {
    font: 500 9px var(--font-mono);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: ${violet};
  }
  h3 {
    font: 600 34px var(--font-display);
    letter-spacing: -0.04em;
    margin: 10px 0 6px;
  }
  .desc {
    font: 400 13px / 1.55 var(--font-body);
    color: #777067;
    max-width: 52ch;
  }
`;
const Metrics = styled.div`
  width: min(1180px, calc(100% - 52px));
  margin: 70px auto 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid #cfc7ba;
  border-radius: 18px;
  overflow: hidden;
  background: #faf6ec;
  .metric {
    padding: 28px 24px;
    border-right: 1px solid #cfc7ba;
  }
  .metric:last-child {
    border: 0;
  }
  .big {
    font: 600 48px var(--font-display);
    letter-spacing: -0.05em;
  }
  .small {
    font: 500 9px var(--font-mono);
    text-transform: uppercase;
    color: #777067;
    margin-top: 5px;
  }
  @media (max-width: 650px) {
    width: calc(100% - 34px);
    grid-template-columns: 1fr;
    .metric {
      border-right: 0;
      border-bottom: 1px solid #cfc7ba;
    }
  }
`;

export default function ProductConsole() {
  const [tab, setTab] = useState<ConsoleTabKey>("overview");
  const data = CONSOLE_DATA[tab];

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
          <span className="live"><span className="dot" />settl recovery console</span>
          <span>engine active · gate armed</span>
        </ConsoleTop>
        <ProductGrid>
          <Tabs role="tablist">
            {(Object.keys(CONSOLE_DATA) as ConsoleTabKey[]).map((key) => (
              <Tab role="tab" aria-selected={key === tab} $on={key === tab} onClick={() => setTab(key)} key={key}>
                {key === tab && <Indicator layoutId="proof-tab" />}
                <div className="l">{key[0].toUpperCase() + key.slice(1)}</div>
                <div className="s">{CONSOLE_DATA[key].sub}</div>
              </Tab>
            ))}
          </Tabs>
          <View>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
                <div className="label">{data.label}</div>
                <h3>{data.title}</h3>
                <div className="desc">{data.desc}</div>
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
