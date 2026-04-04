import Link from "next/link";
import { clearCustomer } from "@/app/actions";
import { getActingCustomerId } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function Nav() {
  const id = await getActingCustomerId();
  let label: string | null = null;
  if (id) {
    const row = getDb()
      .prepare(`SELECT full_name FROM customers WHERE customer_id = ?`)
      .get(id) as { full_name: string } | undefined;
    label = row?.full_name ?? `Customer #${id}`;
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
          Shop Ops
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Select customer
          </Link>
          {id ? (
            <>
              <Link
                href="/dashboard"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Dashboard
              </Link>
              <Link
                href="/orders"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Order history
              </Link>
              <Link
                href="/orders/new"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Place order
              </Link>
            </>
          ) : null}
          <Link
            href="/warehouse"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Warehouse queue
          </Link>
          <Link
            href="/admin/orders"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Admin orders
          </Link>
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {id && label ? (
            <>
              <span className="text-zinc-500 dark:text-zinc-400">Acting as</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {label}
              </span>
              <form action={clearCustomer}>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Change customer
                </button>
              </form>
            </>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              No customer selected
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
