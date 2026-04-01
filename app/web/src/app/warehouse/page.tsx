import { getLateDeliveryQueueTop50 } from "@/lib/queries";
import { RunScoringButton } from "@/components/RunScoringButton";

export const dynamic = "force-dynamic";

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function pct(p: number | null) {
  if (p === null || p === undefined) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

export default async function WarehouseQueuePage() {
  const rows = getLateDeliveryQueueTop50();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Late delivery priority queue
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Top 50 orders ranked by predicted late-delivery probability (
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
              shipments.late_delivery_probability
            </code>
            ). Run scoring to populate or refresh predictions from the ML job.
          </p>
        </div>
        <RunScoringButton />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Rank
              </th>
              <th className="px-3 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                P(late)
              </th>
              <th className="px-3 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Order
              </th>
              <th className="px-3 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Customer
              </th>
              <th className="px-3 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Total
              </th>
              <th className="px-3 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Carrier / method
              </th>
              <th className="px-3 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Days (promised / actual)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.shipment_id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
              >
                <td className="px-3 py-3 tabular-nums text-zinc-500">{i + 1}</td>
                <td className="px-3 py-3 font-medium tabular-nums">
                  {pct(r.late_delivery_probability)}
                </td>
                <td className="px-3 py-3">
                  <span className="font-mono text-xs">#{r.order_id}</span>
                  <div className="text-xs text-zinc-500">{r.order_datetime}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-xs text-zinc-500">id {r.customer_id}</div>
                </td>
                <td className="px-3 py-3 tabular-nums">{money(r.order_total)}</td>
                <td className="px-3 py-3 text-xs">
                  {r.carrier} · {r.shipping_method}
                </td>
                <td className="px-3 py-3 tabular-nums text-xs">
                  {r.promised_days} / {r.actual_days}
                  {r.late_delivery === 1 ? (
                    <span className="ml-2 text-amber-700 dark:text-amber-400">
                      (late)
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
