import { PhysicalPallet } from "./types";

const ENDPOINT = "/api/layout-data";

export async function fetchLayout(): Promise<PhysicalPallet[] | null> {
  const res = await fetch(ENDPOINT);
  const data = await res.json();
  return data.error ? null : data;
}

export async function postSlot(payload: object): Promise<{
  ok: boolean;
  error?: string;
  version?: number;
  sourceVersion?: number;
  targetVersion?: number;
}> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null) as {
    error?: unknown;
    version?: unknown;
    sourceVersion?: unknown;
    targetVersion?: unknown;
  } | null;
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.error === "string" ? data.error : `Save failed (${res.status})`,
    };
  }

  return {
    ok: true,
    ...(typeof data?.version === "number" ? { version: data.version } : {}),
    ...(typeof data?.sourceVersion === "number" ? { sourceVersion: data.sourceVersion } : {}),
    ...(typeof data?.targetVersion === "number" ? { targetVersion: data.targetVersion } : {}),
  };
}

export async function deleteSlot(itemId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers: { "X-Admin-PIN": "1234" },
  });

  const data = await res.json().catch(() => null) as { error?: unknown } | null;
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.error === "string" ? data.error : `Delete failed (${res.status})`,
    };
  }

  return { ok: true };
}