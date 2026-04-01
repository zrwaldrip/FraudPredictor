import type { FraudUpdateInput, Order, OrderWithItems, PurchaseCreateInput } from '../models/purchase'

export type PurchaseFilters = {
  query?: string
  ip_country?: string
  payment_method?: Order['payment_method']
  is_fraud?: 0 | 1 | 'any'
  min_risk_score?: number
  from_datetime?: string
  to_datetime?: string
}

export type PurchaseRepository = {
  listOrders: (filters?: PurchaseFilters) => Promise<Order[]>
  getOrderWithItems: (order_id: number) => Promise<OrderWithItems | null>
  createPurchase: (input: PurchaseCreateInput) => Promise<OrderWithItems>
  updateFraudLabel: (order_id: number, input: FraudUpdateInput) => Promise<Order | null>
}

export const PURCHASE_REPOSITORY_TOKEN = Symbol('PurchaseRepository')

