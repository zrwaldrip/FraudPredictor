import type { Order, OrderItem } from '../models/purchase'
import { computeOrderSubtotal } from '../models/purchase'
import type { PurchaseFilters, PurchaseRepository } from './purchaseRepository'
import { seedOrders, seedOrderItems } from './seedData'

const STORAGE_KEY = 'fraud_app_purchases_v1'

type Store = {
  orders: Order[]
  items: OrderItem[]
  nextOrderId: number
  nextOrderItemId: number
}

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Store
    if (!parsed?.orders || !parsed?.items) throw new Error('bad')
    return parsed
  } catch {
    const maxOrderId = seedOrders.reduce((m, o) => Math.max(m, o.order_id), 0)
    const maxItemId = seedOrderItems.reduce((m, it) => Math.max(m, it.order_item_id), 0)
    const initial: Store = {
      orders: seedOrders,
      items: seedOrderItems,
      nextOrderId: maxOrderId + 1,
      nextOrderItemId: maxItemId + 1,
    }
    saveStore(initial)
    return initial
  }
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function matchesFilters(order: Order, filters: PurchaseFilters): boolean {
  if (filters.is_fraud !== undefined && filters.is_fraud !== 'any') {
    if (order.is_fraud !== filters.is_fraud) return false
  }
  if (filters.payment_method && order.payment_method !== filters.payment_method) return false
  if (filters.ip_country && order.ip_country !== filters.ip_country) return false
  if (typeof filters.min_risk_score === 'number' && order.risk_score < filters.min_risk_score) return false
  if (filters.from_datetime && order.order_datetime < filters.from_datetime) return false
  if (filters.to_datetime && order.order_datetime > filters.to_datetime) return false
  if (filters.query) {
    const q = filters.query.trim().toLowerCase()
    if (q) {
      const hay = [
        String(order.order_id),
        String(order.customer_id),
        order.order_datetime,
        order.shipping_state ?? '',
        order.shipping_zip ?? '',
        order.billing_zip ?? '',
        order.ip_country,
        order.payment_method,
        order.device_type,
        order.promo_code ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
  }
  return true
}

export function createMockPurchaseRepository(): PurchaseRepository {
  return {
    async listOrders(filters) {
      const store = loadStore()
      const f: PurchaseFilters = {
        is_fraud: 'any',
        ...filters,
      }
      return store.orders
        .filter((o) => matchesFilters(o, f))
        .slice()
        .sort((a, b) => (a.order_datetime < b.order_datetime ? 1 : -1))
    },

    async getOrderWithItems(order_id) {
      const store = loadStore()
      const order = store.orders.find((o) => o.order_id === order_id) ?? null
      if (!order) return null
      const items = store.items.filter((it) => it.order_id === order_id)
      return { order, items }
    },

    async createPurchase(input) {
      const store = loadStore()

      const order_subtotal = roundMoney(computeOrderSubtotal(input.items))
      const shipping_fee = roundMoney(input.shipping_fee)
      const tax_amount = roundMoney(input.tax_amount)
      const order_total = roundMoney(order_subtotal + shipping_fee + tax_amount)

      const order: Order = {
        order_id: store.nextOrderId++,
        customer_id: input.customer_id,
        order_datetime: input.order_datetime,
        billing_zip: input.billing_zip,
        shipping_zip: input.shipping_zip,
        shipping_state: input.shipping_state,
        payment_method: input.payment_method,
        device_type: input.device_type,
        ip_country: input.ip_country,
        promo_used: input.promo_used,
        promo_code: input.promo_used ? input.promo_code : null,
        order_subtotal,
        shipping_fee,
        tax_amount,
        order_total,
        risk_score: 0,
        is_fraud: 0,
      }

      const items: OrderItem[] = input.items.map((it) => {
        const line_total = roundMoney(it.quantity * it.unit_price)
        return {
          order_item_id: store.nextOrderItemId++,
          order_id: order.order_id,
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: roundMoney(it.unit_price),
          line_total,
        }
      })

      store.orders.push(order)
      store.items.push(...items)
      saveStore(store)

      return { order, items }
    },

    async updateFraudLabel(order_id, input) {
      const store = loadStore()
      const idx = store.orders.findIndex((o) => o.order_id === order_id)
      if (idx < 0) return null
      const prev = store.orders[idx]
      const next: Order = {
        ...prev,
        is_fraud: input.is_fraud,
        risk_score: typeof input.risk_score === 'number' ? input.risk_score : prev.risk_score,
      }
      store.orders[idx] = next
      saveStore(store)
      return next
    },
  }
}

