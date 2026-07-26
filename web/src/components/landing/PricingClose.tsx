"use client";

import styled from "styled-components";
import { motion } from "framer-motion";

const dark = "#111214";
const paper = "#f1ecdf";
const violet = "#7466f2";
const mint = "#76d9aa";
const ease = [0.22, 0.7, 0.2, 1] as const;

const Pricing = styled.section`
  background: ${paper};
  color: ${dark};
  padding: 130px 0;
  overflow: hidden;
`;
const PriceInner = styled.div`
  width: min(1180px, calc(100% - 52px));
  margin: auto;
  @media (max-width: 700px) {
    width: calc(100% - 34px);
  }
`;
const PriceTop = styled.div`
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 48px;
  align-items: end;
  h2 {
    font: 600 clamp(52px, 7.4vw, 102px) / 0.86 var(--font-display);
    letter-spacing: -0.075em;
    margin: 0;
    max-width: 10ch;
  }
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 28px;
  }
`;
const PricePromise = styled.div`
  border: 1px solid #c9c1b5;
  border-radius: 18px;
  padding: 22px 24px;
  background: #faf6ec;
  .k {
    font: 600 9px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${violet};
  }
  .v {
    font: 500 18px / 1.35 var(--font-display);
    letter-spacing: -0.02em;
    margin-top: 10px;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .pill {
    padding: 7px 10px;
    border-radius: 99px;
    border: 1px solid #cec6ba;
    font: 500 10px var(--font-mono);
    color: #645e56;
    background: #fffdf7;
  }
`;
const Alignment = styled.div`
  margin-top: 54px;
  padding: 28px 30px;
  border: 1px solid #c9c1b5;
  border-radius: 18px;
  background: #f8f3e8;
  position: relative;
  overflow: hidden;
  .route {
    position: absolute;
    left: 10%;
    right: 10%;
    top: 49px;
    height: 2px;
    background: #d7cfc2;
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, ${violet}, ${mint});
  }
  .steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    position: relative;
    z-index: 2;
  }
  .step {
    text-align: center;
  }
  .node {
    width: 18px;
    height: 18px;
    margin: 12px auto 18px;
    border-radius: 50%;
    background: ${paper};
    border: 2px solid ${violet};
  }
  .step:last-child .node {
    border-color: ${mint};
    background: ${mint};
  }
  .k {
    font: 600 8px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #847d74;
  }
  .v {
    font: 600 15px var(--font-display);
    margin-top: 6px;
  }
  .zero {
    color: #3b805f;
  }
  @media (max-width: 620px) {
    padding-inline: 14px;
    .v {
      font-size: 11px;
    }
    .k {
      font-size: 6px;
    }
    .route {
      left: 13%;
      right: 13%;
    }
  }
`;
const PriceRows = styled.div`
  margin-top: 54px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;
const PriceRow = styled.div`
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 30px 32px;
  border: 1px solid #c9c1b5;
  border-radius: 22px;
  background: #faf6ec;
  transition: background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
  &:hover {
    background: #fffdf7;
    transform: translateY(-4px);
    box-shadow: 0 22px 50px rgba(61, 48, 31, 0.1);
  }
  .type {
    font: 600 11px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${violet};
  }
  .amount {
    font: 600 clamp(48px, 6vw, 78px) / 0.95 var(--font-display);
    letter-spacing: -0.06em;
    margin-top: 28px;
  }
  .desc {
    font: 400 14px / 1.6 var(--font-body);
    color: #70695f;
    max-width: 36ch;
    margin-top: auto;
    padding-top: 24px;
  }
`;
const Included = styled.div`
  margin-top: 28px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  .item {
    padding: 10px 13px;
    border: 1px solid #cec6ba;
    border-radius: 99px;
    font: 500 10px var(--font-mono);
    color: #645e56;
    background: #fffdf7;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .check {
    color: #3e8664;
  }
`;

const Close = styled.section`
  min-height: 90svh;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  text-align: center;
  color: #f6f1e8;
  background: radial-gradient(850px 600px at 50% 40%, rgba(160, 145, 255, 0.55), transparent 65%), #171126;
`;
const CloseOrbit = styled(motion.div)`
  position: absolute;
  width: min(760px, 100vw);
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  &::before,
  &::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(118, 217, 170, 0.15);
  }
  &::before {
    inset: 15%;
  }
  &::after {
    inset: 30%;
  }
`;
const CloseCore = styled.div`
  position: relative;
  z-index: 2;
  width: min(900px, calc(100% - 34px));
  .eye {
    font: 500 9px var(--font-mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${mint};
  }
  h2 {
    font: 600 clamp(60px, 9vw, 126px) / 0.83 var(--font-display);
    letter-spacing: -0.08em;
    margin: 22px auto 0;
    max-width: 8ch;
  }
  p {
    font: 400 15px / 1.6 var(--font-body);
    color: rgba(255, 255, 255, 0.58);
    max-width: 45ch;
    margin: 25px auto 0;
  }
  button {
    margin-top: 30px;
    padding: 15px 24px;
    border: 0;
    border-radius: 99px;
    background: #f6f1e8;
    color: #171126;
    font: 600 14px var(--font-body);
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  button:hover {
    transform: translateY(-3px);
    background: ${mint};
    box-shadow: 0 16px 40px rgba(118, 217, 170, 0.22);
  }
`;
const Footer = styled.footer`
  background: #171126;
  color: rgba(255, 255, 255, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 28px max(24px, calc((100% - 1180px) / 2));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  font: 500 9px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  .brand {
    font: 600 17px var(--font-display);
    color: #fff;
    text-transform: none;
    letter-spacing: -0.02em;
  }
  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

export default function PricingClose() {
  return (
    <>
      <Pricing id="pricing">
        <PriceInner>
          <PriceTop>
            <h2>Our fee moves when your money does.</h2>
            <PricePromise>
              <div className="k">incentive alignment</div>
              <div className="v">No seats. No monthly minimum. No fee on an invoice that stays unpaid.</div>
              <div className="pills">
                <span className="pill">pilot is free</span>
                <span className="pill">success fee only</span>
                <span className="pill">never custodial</span>
              </div>
            </PricePromise>
          </PriceTop>
          <Alignment>
            <div className="route">
              <motion.div className="fill" initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={{ once: true }} transition={{ duration: 1.4, ease }} />
            </div>
            <div className="steps">
              <div className="step"><div className="node" /><div className="k">Invoice</div><div className="v">Overdue</div></div>
              <div className="step"><div className="node" /><div className="k">Settl</div><div className="v">Recovery verified</div></div>
              <div className="step"><div className="node" /><div className="k">Your account</div><div className="v zero">Paid</div></div>
            </div>
          </Alignment>
          <PriceRows>
            <PriceRow>
              <div className="type">Controlled pilot</div>
              <div className="amount">Free</div>
              <div className="desc">
                Run the recovery path on your own invoices. Review first touches and inspect the reasoning behind every action.
              </div>
            </PriceRow>
            <PriceRow>
              <div className="type">After the pilot</div>
              <div className="amount">Success fee</div>
              <div className="desc">
                A fee applies only to a verified recovery. If the balance stays unpaid, that invoice costs you nothing.
              </div>
            </PriceRow>
          </PriceRows>
          <Included>
            {["Compliance gate on every send", "Email and optional voice", "First-touch human approval", "Complete execution log", "Payment reconciliation"].map((item) => (
              <span className="item" key={item}><span className="check">✓</span>{item}</span>
            ))}
          </Included>
        </PriceInner>
      </Pricing>

      <Close>
        <CloseOrbit animate={{ rotate: 360 }} transition={{ duration: 70, repeat: Infinity, ease: "linear" }} />
        <CloseCore>
          <div className="eye">the recovery line is ready</div>
          <h2>Let the invoice chase itself.</h2>
          <p>You did the work. Settl handles the path from overdue to paid, with the controls and proof your business needs.</p>
          <button onClick={() => location.assign("/signin")}>Open your dashboard</button>
        </CloseCore>
      </Close>
      <Footer>
        <span className="brand">Settl.</span>
        <span>© 2026 · built for the people who did the work</span>
        <span>never custodial · B2B only</span>
      </Footer>
    </>
  );
}
