// Engine /health projection for the Connections strip.

export interface EngineHealth {
  status: string;
  live_send: boolean;
  inbound_reply_live: boolean;
  drafting: string;
  payments: string;
  inbound_poll: {
    running?: boolean;
    last_polled_at?: string | null;
    last_ok?: boolean | null;
    last_error?: string | null;
  } | null;
}

export const EMPTY_HEALTH: EngineHealth = {
  status: "unknown",
  live_send: false,
  inbound_reply_live: false,
  drafting: "unknown",
  payments: "none",
  inbound_poll: null,
};
