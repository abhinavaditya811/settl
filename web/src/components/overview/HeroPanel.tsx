"use client";

// The Overview hero: "money in motion" (counts up), the outcome framing, a live
// "agent working" pulse, and a recovery trend line with a days-to-pay callout.

import { useEffect, useState } from "react";
import styled, { keyframes, useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { hero } from "./previewData";

const money = (n: number) => "$" + Math.round(n).toLocaleString();

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.7); }
`;

const Card = styled.div`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 14px;
  padding: 22px 24px;
  margin-bottom: 14px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 24px;
`;
const Left = styled.div`min-width: 240px;`;
const Label = styled.div`font-size: 13px; color: ${({ theme }) => theme.textMuted};`;
const Big = styled.div`
  font-size: 46px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin-top: 4px;
  color: ${({ theme }) => theme.accent};
`;
const Outcome = styled.div`
  font-size: 13.5px;
  margin-top: 12px;
  color: ${({ theme }) => theme.text};
  b { font-weight: 700; }
  .g { color: ${({ theme }) => theme.status.sent.fg}; }
`;
const Live = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.textMuted};
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${({ theme }) => theme.status.sent.fg};
    animation: ${pulse} 1.6s ease-in-out infinite;
  }
  b { color: ${({ theme }) => theme.text}; font-weight: 700; }
`;
const Right = styled.div`flex: 1; min-width: 250px;`;
const Spark = styled.path<{ $drawn: boolean }>`
  fill: none;
  stroke: ${({ theme }) => theme.accent};
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 100;
  stroke-dashoffset: ${({ $drawn }) => ($drawn ? 0 : 100)};
  transition: stroke-dashoffset 1.3s ease-out;
`;
const Dso = styled.div`
  display: flex; align-items: center; gap: 7px;
  margin-top: 10px; font-size: 12.5px;
  color: ${({ theme }) => theme.textMuted};
  .old { text-decoration: line-through; }
  .new { color: ${({ theme }) => theme.status.sent.fg}; font-weight: 700; }
`;

function trendPaths(theme: AppTheme) {
  const W = 300, H = 86, P = 8;
  const pts = hero.trend;
  const max = Math.max(...pts), min = Math.min(...pts);
  const xs = pts.map((_, i) => P + ((W - 2 * P) * i) / (pts.length - 1));
  const ys = pts.map((v) => H - 6 - ((H - 14) * (v - min)) / (max - min || 1));
  const line = pts.map((_, i) => `${i ? "L" : "M"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;
  return { W, H, line, area, endX: xs[xs.length - 1], endY: ys[ys.length - 1] };
}

export default function HeroPanel() {
  const theme = useTheme() as AppTheme;
  const [val, setVal] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const { W, H, line, area, endX, endY } = trendPaths(theme);

  useEffect(() => {
    let raf = 0, t0 = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / 1100, 1);
      setVal(Math.round(hero.inMotion * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const id = setTimeout(() => setDrawn(true), 80);
    return () => { cancelAnimationFrame(raf); clearTimeout(id); };
  }, []);

  return (
    <Card>
      <Left>
        <Label>money in motion</Label>
        <Big>{money(val)}</Big>
        <Outcome>
          Settl recovered <b className="g">{money(hero.recovered)}</b> and saved you{" "}
          <b>~{hero.hoursSaved} hours</b> this month
        </Outcome>
        <Live>
          <span className="dot" aria-hidden="true" />
          chasing <b>&nbsp;{hero.chasing} invoices&nbsp;</b> right now
        </Live>
      </Left>
      <Right>
        <Label>recovered · last 8 weeks</Label>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
             style={{ marginTop: 6 }} aria-hidden="true">
          <path d={area} fill={theme.accent} fillOpacity={0.13} />
          <Spark d={line} pathLength={100} $drawn={drawn} />
          <circle cx={endX} cy={endY} r={3.5} fill={theme.accent} />
        </svg>
        <Dso>
          avg days to pay <span className="old">{hero.dsoFrom}</span> →{" "}
          <span className="new">{hero.dsoTo} days</span>
        </Dso>
      </Right>
    </Card>
  );
}
