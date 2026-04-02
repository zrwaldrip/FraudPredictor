import { cookies } from "next/headers";

const COOKIE = "acting_customer_id";

export async function getActingCustomerId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
