import { selectCustomer } from "@/app/actions";
import { listCustomers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SelectCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const customers = await listCustomers();
  const errMsg =
    sp.error === "invalid"
      ? "Invalid selection."
      : sp.error === "notfound"
        ? "Customer not found."
        : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Select customer</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        No login required. Choose who you are acting as for this session. All
        data is read and written to your operational Supabase Postgres database.
      </p>

      {errMsg ? (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          {errMsg}
        </div>
      ) : null}

      <form action={selectCustomer} className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Customer
          <select
            name="customer_id"
            required
            className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
            defaultValue=""
          >
            <option value="" disabled>
              Select a customer…
            </option>
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.full_name} — {c.email}
                {c.city ? ` (${c.city}${c.state ? `, ${c.state}` : ""})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Continue to dashboard
        </button>
      </form>
    </div>
  );
}
