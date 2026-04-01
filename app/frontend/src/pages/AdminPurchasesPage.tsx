import { useEffect, useMemo, useState } from 'react'
import type { Order } from '../models/purchase'
import { money } from '../models/purchase'
import { usePurchaseRepository } from '../services/RepositoryContext'

function Badge(props: { tone: 'good' | 'bad' | 'neutral'; children: string }) {
  const bg =
    props.tone === 'bad'
      ? 'rgba(239,68,68,0.18)'
      : props.tone === 'good'
        ? 'rgba(34,197,94,0.16)'
        : 'rgba(255,255,255,0.08)'
  const border =
    props.tone === 'bad'
      ? 'rgba(239,68,68,0.5)'
      : props.tone === 'good'
        ? 'rgba(34,197,94,0.45)'
        : 'rgba(255,255,255,0.14)'
  return (
    <span style={{ padding: '4px 9px', borderRadius: 999, border: `1px solid ${border}`, background: bg, fontSize: 12 }}>
      {props.children}
    </span>
  )
}

export function AdminPurchasesPage() {
  const repo = usePurchaseRepository()
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<{ order: Order; itemsCount: number; itemsTotal: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<Order['payment_method'] | ''>('')
  const [ipCountry, setIpCountry] = useState('')
  const [isFraud, setIsFraud] = useState<'any' | '0' | '1'>('any')
  const [minRisk, setMinRisk] = useState('')

  const filters = useMemo(() => {
    return {
      query: query.trim() || undefined,
      payment_method: paymentMethod || undefined,
      ip_country: ipCountry.trim().toUpperCase() || undefined,
      is_fraud: isFraud === 'any' ? 'any' : (Number(isFraud) as 0 | 1),
      min_risk_score: minRisk.trim() ? Number(minRisk) : undefined,
    } as const
  }, [query, paymentMethod, ipCountry, isFraud, minRisk])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const list = await repo.listOrders(filters)
      setOrders(list)
      if (selectedId) {
        const maybe = await repo.getOrderWithItems(selectedId)
        if (maybe) {
          setSelected({
            order: maybe.order,
            itemsCount: maybe.items.length,
            itemsTotal: maybe.items.reduce((s, it) => s + it.line_total, 0),
          })
        } else {
          setSelected(null)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchases.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.query, filters.payment_method, filters.ip_country, filters.is_fraud, filters.min_risk_score])

  useEffect(() => {
    async function loadSelected() {
      if (!selectedId) {
        setSelected(null)
        return
      }
      const maybe = await repo.getOrderWithItems(selectedId)
      if (!maybe) {
        setSelected(null)
        return
      }
      setSelected({
        order: maybe.order,
        itemsCount: maybe.items.length,
        itemsTotal: maybe.items.reduce((s, it) => s + it.line_total, 0),
      })
    }
    void loadSelected()
  }, [repo, selectedId])

  async function toggleFraud(order: Order) {
    const next = order.is_fraud === 1 ? 0 : 1
    await repo.updateFraudLabel(order.order_id, { is_fraud: next })
    await refresh()
  }

  return (
    <div className="page">
      <div className="card">
        <h1>All purchases (admin)</h1>
        <p className="muted">
          View all <code>orders</code> and override <code>is_fraud</code>. Risk score is treated as the “pipeline result”
          when present.
        </p>

        <div className="card" style={{ marginTop: 14, padding: 14, background: 'rgba(255,255,255,0.03)' }}>
          <div className="row">
            <label className="field" style={{ flex: 2, minWidth: 220 }}>
              <span>Search</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="order_id, promo, zip, country…" />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 180 }}>
              <span>Payment</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                <option value="">(any)</option>
                <option value="card">card</option>
                <option value="paypal">paypal</option>
                <option value="bank">bank</option>
                <option value="crypto">crypto</option>
              </select>
            </label>
            <label className="field" style={{ flex: 1, minWidth: 140 }}>
              <span>Country</span>
              <input value={ipCountry} onChange={(e) => setIpCountry(e.target.value)} placeholder="US" />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 140 }}>
              <span>Fraud</span>
              <select value={isFraud} onChange={(e) => setIsFraud(e.target.value as any)}>
                <option value="any">(any)</option>
                <option value="0">not fraud</option>
                <option value="1">fraud</option>
              </select>
            </label>
            <label className="field" style={{ flex: 1, minWidth: 140 }}>
              <span>Min risk</span>
              <input value={minRisk} onChange={(e) => setMinRisk(e.target.value)} inputMode="decimal" placeholder="0" />
            </label>
            <div style={{ alignSelf: 'end' }}>
              <button className="button secondary" onClick={() => void refresh()} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div className="row" style={{ marginTop: 14, alignItems: 'stretch', gap: 14 }}>
          <div className="card" style={{ flex: 3, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)' }}>
                    {['Order', 'When', 'Customer', 'Country', 'Payment', 'Total', 'Risk', 'Fraud', ''].map((h) => (
                      <th key={h} style={{ padding: '12px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 14, color: 'var(--muted)' }}>
                        Loading…
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 14, color: 'var(--muted)' }}>
                        No purchases match these filters.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => {
                      const isSelected = o.order_id === selectedId
                      return (
                        <tr
                          key={o.order_id}
                          style={{
                            background: isSelected ? 'rgba(167,139,250,0.10)' : 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedId(o.order_id)}
                        >
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)', fontWeight: 650 }}>#{o.order_id}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>{o.order_datetime}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>{o.customer_id}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>{o.ip_country}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>{o.payment_method}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>{money(o.order_total)}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>{o.risk_score.toFixed(1)}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                            {o.is_fraud === 1 ? <Badge tone="bad">fraud</Badge> : <Badge tone="good">ok</Badge>}
                          </td>
                          <td style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                            <button
                              className="button secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                void toggleFraud(o)
                              }}
                            >
                              Toggle fraud
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ flex: 2, minWidth: 320 }}>
            <div style={{ fontWeight: 650, marginBottom: 6 }}>Details</div>
            {!selected ? (
              <div className="muted">Select a purchase to see details.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Order</div>
                    <div style={{ fontWeight: 650 }}>#{selected.order.order_id}</div>
                  </div>
                  <div>{selected.order.is_fraud === 1 ? <Badge tone="bad">fraud</Badge> : <Badge tone="good">ok</Badge>}</div>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Risk score</div>
                    <div style={{ fontWeight: 650 }}>{selected.order.risk_score.toFixed(1)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Total</div>
                    <div style={{ fontWeight: 650 }}>{money(selected.order.order_total)}</div>
                  </div>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Items</div>
                    <div style={{ fontWeight: 650 }}>{selected.itemsCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Items total</div>
                    <div style={{ fontWeight: 650 }}>{money(selected.itemsTotal)}</div>
                  </div>
                </div>

                <div className="card" style={{ padding: 12, background: 'rgba(255,255,255,0.03)' }}>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                    Admin override (choice C)
                  </div>
                  <div className="row">
                    <button
                      className="button primary"
                      onClick={() => void toggleFraud(selected.order)}
                    >
                      Toggle is_fraud
                    </button>
                    <button
                      className="button secondary"
                      onClick={async () => {
                        const next = Math.max(0, Math.min(100, (selected.order.risk_score + 10)))
                        await repo.updateFraudLabel(selected.order.order_id, { is_fraud: selected.order.is_fraud, risk_score: next })
                        await refresh()
                      }}
                    >
                      +10 risk
                    </button>
                    <button
                      className="button secondary"
                      onClick={async () => {
                        const next = Math.max(0, Math.min(100, (selected.order.risk_score - 10)))
                        await repo.updateFraudLabel(selected.order.order_id, { is_fraud: selected.order.is_fraud, risk_score: next })
                        await refresh()
                      }}
                    >
                      -10 risk
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

