import { redirect } from "next/navigation";
import Link from "next/link";
import { getActingCustomerId } from "@/lib/session";
import { getDashboardSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default async function CustomerDashboardPage() {
  const id = await getActingCustomerId();
  if (!id) redirect("/");

  const summary = await getDashboardSummary(id);
  if (!summary) redirect("/");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Customer dashboard</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Order summaries for{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {summary.customer.full_name}
        </span>
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <dt className="text-xs font-medium uppercase text-zinc-500">Orders</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {summary.order_count}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <dt className="text-xs font-medium uppercase text-zinc-500">
            Total spent
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {money(summary.total_spent)}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <dt className="text-xs font-medium uppercase text-zinc-500">
            Last order
          </dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
            {summary.last_order_at ?? "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/orders/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Place new order
        </Link>
        <Link
          href="/orders"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Order history
        </Link>
      </div>
    </div>
  );
}
