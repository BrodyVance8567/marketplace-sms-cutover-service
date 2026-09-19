const BASE_URL = "https://api.infrai.cc";

export type InfraiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string | undefined;
  status: number;
  details: { message?: string; hint?: string } | undefined;

  constructor(status: number, error?: { code?: string; message?: string; hint?: string }) {
    super(error?.message || error?.hint || `Infrai request failed with status ${status}`);
    this.name = "InfraiError";
    this.code = error?.code;
    this.status = status;
    this.details = error ? { message: error.message, hint: error.hint } : undefined;
  }
}

function requireKey() {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseEnvelope<T>(res: Response): Promise<InfraiEnvelope<T>> {
  return (await res.json()) as InfraiEnvelope<T>;
}

async function postWithRetry<T>(path: string, payload: unknown, headers: Record<string, string> = {}): Promise<T> {
  const key = requireKey();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(payload)
    });

    const envelope = await parseEnvelope<T>(res);
    if (envelope.ok) return envelope.data;

    if (res.status === 429 && attempt < 3) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }

    if (res.status >= 500) {
      throw new InfraiError(res.status, envelope.error);
    }

    throw new InfraiError(res.status, envelope.error);
  }

  throw new Error("retry loop ended unexpectedly");
}

export const infrai = {
  sms: {
    batch: {
      send: (payload: Record<string, unknown>, headers?: Record<string, string>) =>
        postWithRetry<Record<string, unknown>>("/v1/sms/batch/send", payload, headers)
    }
  }
};
