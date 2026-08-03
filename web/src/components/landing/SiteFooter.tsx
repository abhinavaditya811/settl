"use client";

import Link from "next/link";
import styled from "styled-components";
import { LedgerIcon } from "./LedgerIcons";
import { setLandingHash } from "./LandingChrome";

const mint = "#76d9aa";
const violet = "#7466f2";

const Foot = styled.footer`
  background: #120e1d;
  color: rgba(255, 255, 255, 0.55);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 64px max(24px, calc((100% - 1180px) / 2)) 28px;
`;

const Top = styled.div`
  display: grid;
  grid-template-columns: 1.35fr repeat(3, minmax(120px, 1fr));
  gap: 48px 36px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
    gap: 36px;
  }
`;

const Brand = styled.div`
  max-width: 320px;
  .lock {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mark {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: ${mint};
    background: rgba(118, 217, 170, 0.08);
    border: 1px solid rgba(118, 217, 170, 0.28);
  }
  .mark svg {
    width: 17px;
    height: 17px;
  }
  .name {
    font: 600 20px var(--font-display);
    color: #fff;
    letter-spacing: -0.02em;
  }
  .name span {
    color: ${violet};
  }
  .tag {
    margin: 16px 0 0;
    font: 400 13.5px / 1.65 var(--font-body);
    color: rgba(255, 255, 255, 0.5);
  }
  .status {
    margin-top: 18px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid rgba(118, 217, 170, 0.22);
    background: rgba(118, 217, 170, 0.06);
    font: 500 9px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(214, 245, 229, 0.85);
  }
  .pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${mint};
    box-shadow: 0 0 0 0 rgba(118, 217, 170, 0.55);
    animation: footPulse 1.8s ease-out infinite;
  }
  @keyframes footPulse {
    70% {
      box-shadow: 0 0 0 8px rgba(118, 217, 170, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(118, 217, 170, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulse {
      animation: none;
      box-shadow: none;
    }
  }
`;

const Col = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
  .h {
    font: 600 9px var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 4px;
  }
  a,
  button {
    text-align: left;
    font: 400 13.5px var(--font-body);
    color: rgba(255, 255, 255, 0.58);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.18s ease, transform 0.18s ease;
  }
  a:hover,
  button:hover {
    color: #fff;
    transform: translateX(2px);
  }
  a:focus,
  button:focus {
    outline: none;
  }
  a:focus-visible,
  button:focus-visible {
    color: #fff;
    outline: 2px solid ${mint};
    outline-offset: 3px;
    border-radius: 4px;
  }
  @media (prefers-reduced-motion: reduce) {
    a:hover,
    button:hover {
      transform: none;
    }
  }
`;

const Bottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 52px;
  padding-top: 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font: 500 9px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.38);
  .legal {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }
  .legal a {
    color: inherit;
    text-decoration: none;
    transition: color 0.18s ease;
  }
  .legal a:hover {
    color: #fff;
  }
  .legal a:focus {
    outline: none;
  }
  .legal a:focus-visible {
    color: #fff;
    outline: 2px solid ${mint};
    outline-offset: 3px;
    border-radius: 4px;
  }
`;

function go(id: string) {
  setLandingHash(id);
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function SiteFooter() {
  return (
    <Foot>
      <Top>
        <Brand>
          <div className="lock">
            <span className="mark" aria-hidden="true">
              <LedgerIcon name="reconcile" />
            </span>
            <span className="name">
              Settl<span>.</span>
            </span>
          </div>
          <p className="tag">
            The autonomous agent that gets small businesses paid on overdue invoices, without the awkward chasing.
          </p>
          <div className="status">
            <span className="pulse" aria-hidden="true" />
            gate armed · demo data
          </div>
        </Brand>

        <Col>
          <div className="h">Product</div>
          <button type="button" onClick={() => go("recovery-story")}>
            Recovery path
          </button>
          <button type="button" onClick={() => go("voice")}>
            Voice agent
          </button>
          <button type="button" onClick={() => go("console")}>
            Console
          </button>
          <button type="button" onClick={() => go("safety")}>
            Safety gate
          </button>
        </Col>

        <Col>
          <div className="h">Company</div>
          <button type="button" onClick={() => go("pricing")}>
            Pricing
          </button>
          <Link href="/demo">Live demo</Link>
          <Link href="/signin">Open dashboard</Link>
          <a href="mailto:illgamerguy7@gmail.com">Contact</a>
        </Col>

        <Col>
          <div className="h">Legal</div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms of use</Link>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.38)", lineHeight: 1.5 }}>
            Never custodial · B2B only
          </span>
        </Col>
      </Top>

      <Bottom>
        <span>© 2026 Settl. All rights reserved.</span>
        <span>Built for the people who did the work.</span>
        <div className="legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </Bottom>
    </Foot>
  );
}
