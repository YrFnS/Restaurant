export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: string;
  notes: string | null;
  menuItem: {
    id: string;
    nameEn: string;
    nameAr: string;
    image: string;
    price: number;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  estimatedReady: string | null;
  completedAt: string | null;
  createdAt: string;
  items: OrderItem[];
}
