import { PhysicalPallet } from "./types";

const ENDPOINT = "/api/layout-data";

export async function fetchLayout(): Promise<PhysicalPallet[] | null> {
  const res = await fetch(ENDPOINT);
  const data = await res.json();
  return data.error ? null : data;
}

export async function postSlot(payload: object): Promise<void> {
  await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}