"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { placeOrder, type LineInput } from "@/app/actions";
import type { ProductRow } from "@/lib/queries";

type Props = { products: ProductRow[] };

export function PlaceOrderForm({ products }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [billingZip, setBillingZip] = useState("");
  const [shippingZip, setShippingZip] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [deviceType, setDeviceType] = useState("mobile");
  const [ipCountry, setIpCountry] = useState("US");
  const [promoUsed, setPromoUsed] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [shippingFee, setShippingFee] = useState("6.99");
  const [taxAmount, setTaxAmount] = useState("0");

  const [lines, setLines] = useState<
    { product_id: string; quantity: string; unit_price: string }[]
  >(() =>
    products.length
      ? [
          {
            product_id: String(products[0].product_id),
            quantity: "1",
            unit_price: String(products[0].price),
          },
        ]
      : [],
  );

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        product_id: String(products[0]?.product_id ?? ""),
        quantity: "1",
        unit_price: "",
      },
    ]);
  }

  function setProductPriceFromCatalog(idx: number, productIdStr: string) {
    const pid = Number.parseInt(productIdStr, 10);
    const p = products.find((x) => x.product_id === pid);
    setLines((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              product_id: productIdStr,
              unit_price: p ? String(p.price) : row.unit_price,
            }
          : row,
      ),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const items: LineInput[] = [];
    for (const row of lines) {
      const product_id = Number.parseInt(row.product_id, 10);
      const quantity = Number.parseInt(row.quantity, 10);
      const unit_price = Number.parseFloat(row.unit_price);
      if (!Number.isFinite(product_id) || product_id < 1) continue;
      if (!Number.isFinite(quantity) || quantity < 1) continue;
      if (!Number.isFinite(unit_price) || unit_price < 0) continue;
      items.push({ product_id, quantity, unit_price });
    }
    const result = await placeOrder({
      billing_zip: billingZip.trim() || null,
      shipping_zip: shippingZip.trim() || null,
      shipping_state: shippingState.trim() || null,
      payment_method: paymentMethod,
      device_type: deviceType,
      ip_country: ipCountry.trim() || "US",
      promo_used: promoUsed,
      promo_code: promoUsed ? promoCode.trim() || null : null,
      shipping_fee: Number.parseFloat(shippingFee) || 0,
      tax_amount: Number.parseFloat(taxAmount) || 0,
      items,
    });
    setPending(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!products.length) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No active products in the database.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Billing ZIP</span>
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={billingZip}
            onChange={(e) => setBillingZip(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Shipping ZIP</span>
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={shippingZip}
            onChange={(e) => setShippingZip(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Shipping state</span>
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={shippingState}
            onChange={(e) => setShippingState(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">IP country</span>
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={ipCountry}
            onChange={(e) => setIpCountry(e.target.value.toUpperCase())}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Payment</span>
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="card">card</option>
            <option value="paypal">paypal</option>
            <option value="bank">bank</option>
            <option value="crypto">crypto</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Device</span>
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
          >
            <option value="mobile">mobile</option>
            <option value="desktop">desktop</option>
            <option value="tablet">tablet</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Shipping fee</span>
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Tax amount</span>
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={taxAmount}
            onChange={(e) => setTaxAmount(e.target.value)}
            inputMode="decimal"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={promoUsed}
          onChange={(e) => setPromoUsed(e.target.checked)}
        />
        Promo used
        <input
          className="ml-2 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1 dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="Code"
          value={promoCode}
          disabled={!promoUsed}
          onChange={(e) => setPromoCode(e.target.value)}
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Line items
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add line
          </button>
        </div>
        {lines.map((row, idx) => (
          <div
            key={idx}
            className="grid gap-2 rounded-md border border-zinc-200 p-3 sm:grid-cols-4 dark:border-zinc-700"
          >
            <label className="text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Product</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={row.product_id}
                onChange={(e) => setProductPriceFromCatalog(idx, e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} (${p.price.toFixed(2)})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Qty</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                value={row.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((r, i) =>
                      i === idx ? { ...r, quantity: e.target.value } : r,
                    ),
                  )
                }
                inputMode="numeric"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-600 dark:text-zinc-400">Unit price</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                value={row.unit_price}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((r, i) =>
                      i === idx ? { ...r, unit_price: e.target.value } : r,
                    ),
                  )
                }
                inputMode="decimal"
              />
            </label>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Placing order…" : "Place order"}
      </button>
    </form>
  );
}
