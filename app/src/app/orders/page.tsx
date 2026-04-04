import Link from "next/link";
import { redirect } from "next/navigation";
import { getActingCustomerId } from "@/lib/session";
import { listOrdersForCustomer } from "@/lib/queries";

export const dynamic = "force-dynamic";

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default async function OrderHistoryPage() {
  const id = await getActingCustomerId();
  if (!id) redirect("/");

  const rows = await listOrdersForCustomer(id);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order history</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            All past orders for the selected customer (from{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">orders</code>).
          </p>
        </div>
        <Link
          href="/orders/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Place new order
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Order #
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Date
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Total
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Fraud flag
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Shipment late (actual)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No orders yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.order_id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 font-mono tabular-nums">{r.order_id}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {r.order_datetime}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{money(r.order_total)}</td>
                  <td className="px-4 py-3">{r.is_fraud ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    {r.shipment_late === null
                      ? "—"
                      : r.shipment_late === 1
                        ? "Late"
                        : "On time"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
