import { setPipelineFraudStatus } from "@/app/actions";
import { listAllOrdersForAdmin } from "@/lib/queries";

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

export default async function AdminOrdersPage() {
  const rows = await listAllOrdersForAdmin(2000);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Admin orders view</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        All orders with pipeline-predicted fraud status (display source) and
        training label from{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">orders</code>.
      </p>
      <p className="mt-4 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Pipeline fraud scores are refreshed by{" "}
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">
          Vercel Cron
        </strong>{" "}
        (daily at 03:00 UTC — see <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">app/vercel.json</code>
        ). To run manually: <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">GET</code> or{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">POST</code>{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">/api/cron/fraud-train</code> with{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">Authorization: Bearer &lt;CRON_SECRET&gt;</code>{" "}
        or header <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">x-cron-secret</code> when{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">CRON_SECRET</code> is set in Vercel.
      </p>

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
                Customer
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Total
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Risk score
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Pipeline fraud
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                P(fraud)
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Scored at
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Training label
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                Admin override
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No orders found.
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
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.customer_name}</div>
                    <div className="text-xs text-zinc-500">id {r.customer_id}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{money(r.order_total)}</td>
                  <td className="px-4 py-3 tabular-nums">{r.risk_score.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {r.fraud_prediction === null
                      ? "Not scored yet"
                      : r.fraud_prediction === 1
                        ? "Yes"
                        : "No"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{pct(r.fraud_probability)}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">
                    {r.fraud_scored_at ?? "—"}
                  </td>
                  <td className="px-4 py-3">{r.is_fraud ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <form action={setPipelineFraudStatus}>
                        <input type="hidden" name="order_id" value={r.order_id} />
                        <input type="hidden" name="prediction" value="1" />
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Mark fraud
                        </button>
                      </form>
                      <form action={setPipelineFraudStatus}>
                        <input type="hidden" name="order_id" value={r.order_id} />
                        <input type="hidden" name="prediction" value="0" />
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Mark not fraud
                        </button>
                      </form>
                    </div>
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

