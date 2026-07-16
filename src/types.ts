export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  photoUrl?: string;
  priceRmb: number;
  priceMad: number;
  reference?: string;
  category: string;
  description?: string;
  section: 'blue' | 'pink';
  createdAt?: string;
}

export type OrderStatus = 'pending' | 'reviewed' | 'finalized';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productPhotoUrl?: string;
  unitPriceRmb?: number;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  user?: User;
  items: OrderItem[];
  shippingCost: number;
  status: OrderStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartLine {
  product: Product;
  quantity: number;
}
