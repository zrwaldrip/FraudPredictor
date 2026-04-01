import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { DeviceType, PaymentMethod, PurchaseCreateInput } from '../models/purchase'
import { computeOrderSubtotal, money } from '../models/purchase'
import { usePurchaseRepository } from '../services/RepositoryContext'

type DraftItem = { product_id: string; quantity: string; unit_price: string }

function nowSqliteLike() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`
}

export function NewPurchasePage() {
  const repo = usePurchaseRepository()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ order_id: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState('1')
  const [orderDatetime, setOrderDatetime] = useState(nowSqliteLike)
  const [billingZip, setBillingZip] = useState('28289')
  const [shippingZip, setShippingZip] = useState('28289')
  const [shippingState, setShippingState] = useState('CO')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [deviceType, setDeviceType] = useState<DeviceType>('mobile')
  const [ipCountry, setIpCountry] = useState('US')
  const [promoUsed, setPromoUsed] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [shippingFee, setShippingFee] = useState('6.99')
  const [taxAmount, setTaxAmount] = useState('1.40')
  const [items, setItems] = useState<DraftItem[]>([
    { product_id: '1', quantity: '1', unit_price: '49.01' },
  ])

  const computed = useMemo(() => {
    const parsedItems = items
      .map((it) => ({
        product_id: Number(it.product_id),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      }))
      .filter((it) => Number.isFinite(it.product_id) && Number.isFinite(it.quantity) && Number.isFinite(it.unit_price))
      .filter((it) => it.product_id > 0 && it.quantity > 0 && it.unit_price >= 0)

    const subtotal = computeOrderSubtotal(parsedItems)
    const ship = Number(shippingFee) || 0
    const tax = Number(taxAmount) || 0
    const total = subtotal + ship + tax
    return { parsedItems, subtotal, ship, tax, total }
  }, [items, shippingFee, taxAmount])

  function addItem() {
    setItems((prev) => [...prev, { product_id: '1', quantity: '1', unit_price: '0.00' }])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const customer_id = Number(customerId)
    if (!Number.isFinite(customer_id) || customer_id <= 0) {
      setError('Customer ID must be a positive number.')
      return
    }
    if (computed.parsedItems.length < 1) {
      setError('Add at least one valid line item.')
      return
    }

    const input: PurchaseCreateInput = {
      customer_id,
      order_datetime: orderDatetime,
      billing_zip: billingZip.trim() ? billingZip.trim() : null,
      shipping_zip: shippingZip.trim() ? shippingZip.trim() : null,
      shipping_state: shippingState.trim() ? shippingState.trim() : null,
      payment_method: paymentMethod,
      device_type: deviceType,
      ip_country: ipCountry.trim() || 'US',
      promo_used: promoUsed ? 1 : 0,
      promo_code: promoUsed ? (promoCode.trim() || null) : null,
      shipping_fee: Number(shippingFee) || 0,
      tax_amount: Number(taxAmount) || 0,
      items: computed.parsedItems,
    }

    setSubmitting(true)
    try {
      const created = await repo.createPurchase(input)
      setResult({ order_id: created.order.order_id })
      setItems([{ product_id: '1', quantity: '1', unit_price: '0.00' }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Create purchase</h1>
        <p className="muted">
          This creates an <code>orders</code> row plus <code>order_items</code> rows in the mock store.
        </p>

        <form className="form" onSubmit={onSubmit}>
          <div className="row">
            <label className="field" style={{ flex: 1, minWidth: 220 }}>
              <span>Customer ID</span>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} inputMode="numeric" />
            </label>
            <label className="field" style={{ flex: 2, minWidth: 320 }}>
              <span>Order datetime (SQLite TEXT)</span>
              <input value={orderDatetime} onChange={(e) => setOrderDatetime(e.target.value)} />
            </label>
          </div>

          <div className="row">
            <label className="field" style={{ flex: 1, minWidth: 180 }}>
              <span>Billing ZIP</span>
              <input value={billingZip} onChange={(e) => setBillingZip(e.target.value)} />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 180 }}>
              <span>Shipping ZIP</span>
              <input value={shippingZip} onChange={(e) => setShippingZip(e.target.value)} />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 160 }}>
              <span>Shipping state</span>
              <input value={shippingState} onChange={(e) => setShippingState(e.target.value)} />
            </label>
          </div>

          <div className="row">
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span>Payment method</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="card">card</option>
                <option value="paypal">paypal</option>
                <option value="bank">bank</option>
                <option value="crypto">crypto</option>
              </select>
            </label>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span>Device type</span>
              <select value={deviceType} onChange={(e) => setDeviceType(e.target.value as DeviceType)}>
                <option value="mobile">mobile</option>
                <option value="desktop">desktop</option>
                <option value="tablet">tablet</option>
              </select>
            </label>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span>IP country</span>
              <input value={ipCountry} onChange={(e) => setIpCountry(e.target.value.toUpperCase())} />
            </label>
          </div>

          <div className="row">
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span>Shipping fee</span>
              <input value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} inputMode="decimal" />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span>Tax amount</span>
              <input value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} inputMode="decimal" />
            </label>
            <label className="field" style={{ flex: 2, minWidth: 280 }}>
              <span>Promo</span>
              <div className="row">
                <label className="row" style={{ gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={promoUsed}
                    onChange={(e) => setPromoUsed(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span className="muted">Promo used</span>
                </label>
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="PROMO_CODE"
                  disabled={!promoUsed}
                  style={{ flex: 1, minWidth: 160 }}
                />
              </div>
            </label>
          </div>

          <div className="card" style={{ padding: 14, background: 'rgba(255,255,255,0.03)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 650 }}>Line items</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Each item becomes a row in <code>order_items</code>.
                </div>
              </div>
              <button type="button" className="button secondary" onClick={addItem}>
                Add item
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {items.map((it, idx) => (
                <div key={idx} className="row" style={{ alignItems: 'flex-end' }}>
                  <label className="field" style={{ flex: 1, minWidth: 160 }}>
                    <span>Product ID</span>
                    <input
                      value={it.product_id}
                      onChange={(e) =>
                        setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, product_id: e.target.value } : p)))
                      }
                      inputMode="numeric"
                    />
                  </label>
                  <label className="field" style={{ flex: 1, minWidth: 140 }}>
                    <span>Quantity</span>
                    <input
                      value={it.quantity}
                      onChange={(e) =>
                        setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: e.target.value } : p)))
                      }
                      inputMode="numeric"
                    />
                  </label>
                  <label className="field" style={{ flex: 1, minWidth: 160 }}>
                    <span>Unit price</span>
                    <input
                      value={it.unit_price}
                      onChange={(e) =>
                        setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, unit_price: e.target.value } : p)))
                      }
                      inputMode="decimal"
                    />
                  </label>
                  <div style={{ minWidth: 150 }}>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Line total
                    </div>
                    <div style={{ fontWeight: 650 }}>
                      {money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error ? <div className="error">{error}</div> : null}
          {result ? (
            <div className="pill" style={{ justifySelf: 'start' }}>
              Created order #{result.order_id}
            </div>
          ) : null}

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Subtotal: <b>{money(computed.subtotal)}</b> · Shipping: <b>{money(computed.ship)}</b> · Tax:{' '}
              <b>{money(computed.tax)}</b> · Total: <b>{money(computed.total)}</b>
            </div>
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

