export type PaymentMethod = 'card' | 'paypal' | 'bank' | 'crypto'
export type DeviceType = 'mobile' | 'desktop' | 'tablet'

export type Order = {
  order_id: number
  customer_id: number
  order_datetime: string
  billing_zip: string | null
  shipping_zip: string | null
  shipping_state: string | null
  payment_method: PaymentMethod
  device_type: DeviceType
  ip_country: string
  promo_used: 0 | 1
  promo_code: string | null
  order_subtotal: number
  shipping_fee: number
  tax_amount: number
  order_total: number
  risk_score: number
  is_fraud: 0 | 1
}

export type OrderItem = {
  order_item_id: number
  order_id: number
  product_id: number
  quantity: number
  unit_price: number
  line_total: number
}

export type OrderWithItems = {
  order: Order
  items: OrderItem[]
}

export type PurchaseCreateItemInput = {
  product_id: number
  quantity: number
  unit_price: number
}

export type PurchaseCreateInput = {
  customer_id: number
  order_datetime: string
  billing_zip: string | null
  shipping_zip: string | null
  shipping_state: string | null
  payment_method: PaymentMethod
  device_type: DeviceType
  ip_country: string
  promo_used: 0 | 1
  promo_code: string | null
  shipping_fee: number
  tax_amount: number
  items: PurchaseCreateItemInput[]
}

export type FraudUpdateInput = {
  is_fraud: 0 | 1
  risk_score?: number
}

export function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

export function computeOrderSubtotal(items: Array<{ quantity: number; unit_price: number }>) {
  return items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
}

