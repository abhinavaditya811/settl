"use client";

// Activity tab: scan-first audit trail with pulse, search, chips, expand-in-place.

import styled from "styled-components";
import ActivityPulse from "./ActivityPulse";
import ActivityRow from "./ActivityRow";
import { downloadEvidencePack } from "./evidenceDownload";
import {
  Empty,
  Filter,
  Filters,
  Head,
  HeadBtns,
  Page,
  Search,
  Stack,
  Toolbar,
  AddBtn,
} from "./invoicesChrome";
import { Rise } from "./overviewChrome";
import { entryKey, useActivityFeed } from "./useActivityFeed";
import { useBoard } from "@/lib/BoardContext";

const Day = styled.div`
  font-size: 11.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 4px 0 2px;
`;

export default function ActivityView() {
  const f = useActivityFeed();
  const { activity } = useBoard();

  if (f.activity.length === 0) {
    return (
      <Rise>
        <Page>
          <Head>
            <div>
              <h1>Activity</h1>
              <p>Everything the agent did. The audit trail behind every invoice.</p>
            </div>
          </Head>
          <Empty>
            <div className="t">Nothing logged yet</div>
            <div className="s">
              When Settl chases, holds, or escalates, those decisions land here.
            </div>
          </Empty>
        </Page>
      </Rise>
    );
  }

  return (
    <Rise>
      <Page>
        <Head>
          <div>
            <h1>Activity</h1>
            <p>
              Scan the trail, open Why for the full reason, jump to any invoice.
            </p>
          </div>
          <HeadBtns>
            <AddBtn
              type="button"
              onClick={() => downloadEvidencePack({ activity })}
            >
              Download evidence
            </AddBtn>
          </HeadBtns>
        </Head>

        <ActivityPulse
          eventsToday={f.eventsToday}
          safetyFlags={f.safetyFlags}
        />

        <Search
          placeholder="Search by invoice, debtor, or reason…"
          value={f.q}
          onChange={(e) => f.setQ(e.target.value)}
        />

        <Toolbar>
          <Filters>
            <Filter
              type="button"
              $on={f.agent === "all"}
              onClick={() => f.setAgent("all")}
            >
              All
            </Filter>
            {f.agents.map((a) => (
              <Filter
                key={a}
                type="button"
                $on={f.agent === a}
                onClick={() => f.setAgent(a)}
              >
                {f.friendlyAgent(a)}
              </Filter>
            ))}
            <Filter
              type="button"
              $on={f.safetyOnly}
              onClick={() => f.setSafetyOnly((s) => !s)}
            >
              Safety only
            </Filter>
            <Filter
              type="button"
              $on={f.technical}
              onClick={() => f.setTechnical(!f.technical)}
            >
              Technical
            </Filter>
          </Filters>
        </Toolbar>

        {f.groups.length === 0 ? (
          <Empty>
            <div className="t">Nothing in this view</div>
            <div className="s">
              {f.q.trim()
                ? "No events match that search. Clear it or try another filter."
                : f.safetyOnly
                  ? "No safety flags match. Try All."
                  : "No activity matches your filters."}
            </div>
          </Empty>
        ) : (
          f.groups.map(([day, items]) => (
            <div key={day}>
              <Day>{day}</Day>
              <Stack>
                {items.map(({ entry, index }) => {
                  const key = entryKey(entry, index);
                  return (
                    <ActivityRow
                      key={key}
                      entry={entry}
                      invoice={f.byId.get(entry.invoice_id)}
                      open={f.openKey === key}
                      technical={f.technical}
                      onToggle={() =>
                        f.setOpenKey((cur) => (cur === key ? null : key))
                      }
                    />
                  );
                })}
              </Stack>
            </div>
          ))
        )}
      </Page>
    </Rise>
  );
}
