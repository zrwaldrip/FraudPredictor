import { redirect } from "next/navigation";
import { PlaceOrderForm } from "@/components/PlaceOrderForm";
import { getActingCustomerId } from "@/lib/session";
import { listActiveProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlaceOrderPage() {
  const id = await getActingCustomerId();
  if (!id) redirect("/");

  const products = listActiveProducts();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Place new order</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Creates rows in <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">orders</code>,{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">order_items</code>, and{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">shipments</code> in{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">shop.db</code>.
      </p>
      <div className="mt-8">
        <PlaceOrderForm products={products} />
      </div>
    </div>
  );
}
