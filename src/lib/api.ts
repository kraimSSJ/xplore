import { supabase, createIsolatedClient, PRODUCT_PHOTOS_BUCKET } from './supabaseClient';
import { Order, OrderItem, OrderStatus, Product, User, UserRole } from '../types';

// ----------------------------------------------------------------------------
// Mapping helpers: DB uses snake_case, the app (kept identical to the old
// backend's DTOs) uses camelCase.
// ----------------------------------------------------------------------------
function mapProduct(row: any, rate: number): Product {
  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photo_url || undefined,
    priceRmb: row.price_rmb,
    priceMad: Math.round(row.price_rmb * rate * 100) / 100,
    reference: row.reference || undefined,
    category: row.category,
    description: row.description || undefined,
    createdAt: row.created_at,
  };
}

function mapProfile(row: any): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

function mapOrderItem(row: any): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productPhotoUrl: row.product_photo_url || undefined,
    unitPriceRmb: row.unit_price_rmb ?? undefined,
    unitPrice: row.unit_price,
    quantity: row.quantity,
  };
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    userId: row.user_id,
    user: row.profiles ? mapProfile(row.profiles) : undefined,
    items: (row.order_items || []).map(mapOrderItem),
    shippingCost: row.shipping_cost,
    status: row.status as OrderStatus,
    adminNotes: row.admin_notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwIfError(error: any) {
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------------------
// Settings (exchange rate)
// ----------------------------------------------------------------------------
export async function getExchangeRate(): Promise<number> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('rmb_to_mad_rate')
    .eq('id', 1)
    .single();
  throwIfError(error);
  return data?.rmb_to_mad_rate ?? 1.35;
}

export async function updateExchangeRate(rate: number): Promise<number> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ rmb_to_mad_rate: rate, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('rmb_to_mad_rate')
    .single();
  throwIfError(error);
  return data.rmb_to_mad_rate;
}

// ----------------------------------------------------------------------------
// Products
// ----------------------------------------------------------------------------
export async function fetchProducts(category?: string): Promise<Product[]> {
  const rate = await getExchangeRate();
  let query = supabase.from('products').select('*').order('created_at', { ascending: false });
  if (category && category !== 'all') {
    query = query.eq('category', category);
  }
  const { data, error } = await query;
  throwIfError(error);
  return (data || []).map((row) => mapProduct(row, rate));
}

export async function fetchProductCategories(): Promise<string[]> {
  const { data, error } = await supabase.from('products').select('category');
  throwIfError(error);
  const set = new Set<string>();
  (data || []).forEach((r: any) => r.category && set.add(r.category));
  return Array.from(set);
}

export async function createProduct(payload: {
  name: string;
  priceRmb: number;
  reference?: string;
  category?: string;
  description?: string;
  photoUrl?: string;
}): Promise<Product> {
  const rate = await getExchangeRate();
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: payload.name,
      price_rmb: payload.priceRmb,
      reference: payload.reference || null,
      category: payload.category || 'Uncategorized',
      description: payload.description || null,
      photo_url: payload.photoUrl || null,
    })
    .select('*')
    .single();
  throwIfError(error);
  return mapProduct(data, rate);
}

export async function updateProduct(
  id: string,
  payload: Partial<{
    name: string;
    priceRmb: number;
    reference: string;
    category: string;
    description: string;
    photoUrl: string;
  }>,
): Promise<Product> {
  const rate = await getExchangeRate();
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.priceRmb !== undefined) patch.price_rmb = payload.priceRmb;
  if (payload.reference !== undefined) patch.reference = payload.reference;
  if (payload.category !== undefined) patch.category = payload.category;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.photoUrl !== undefined) patch.photo_url = payload.photoUrl;

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  throwIfError(error);
  return mapProduct(data, rate);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  throwIfError(error);
}

export async function uploadProductPhoto(file: File): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_PHOTOS_BUCKET)
    .upload(fileName, file, { upsert: true, contentType: file.type });
  throwIfError(error);
  const { data } = supabase.storage.from(PRODUCT_PHOTOS_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// ----------------------------------------------------------------------------
// Orders
// ----------------------------------------------------------------------------
const ORDER_SELECT = '*, profiles(*), order_items(*)';

export async function createOrderFromCart(
  userId: string,
  items: { productId: string; quantity: number }[],
): Promise<Order> {
  if (!items || items.length === 0) throw new Error('Cart is empty');

  const productIds = items.map((i) => i.productId);
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds);
  throwIfError(prodError);

  const productMap = new Map((products || []).map((p: any) => [p.id, p]));
  const rate = await getExchangeRate();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ user_id: userId, status: 'pending', shipping_cost: 0 })
    .select('*')
    .single();
  throwIfError(orderError);

  const itemRows = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    return {
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      product_photo_url: product.photo_url,
      unit_price_rmb: product.price_rmb,
      unit_price: Math.round(product.price_rmb * rate * 100) / 100,
      quantity: item.quantity,
    };
  });

  const { error: itemsError } = await supabase.from('order_items').insert(itemRows);
  throwIfError(itemsError);

  return fetchOrder(order.id);
}

export async function fetchMyOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  throwIfError(error);
  return (data || []).map(mapOrder);
}

export async function fetchAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false });
  throwIfError(error);
  return (data || []).map(mapOrder);
}

export async function fetchOrder(id: string): Promise<Order> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).single();
  throwIfError(error);
  return mapOrder(data);
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  throwIfError(error);
}

export async function updateOrderShipping(id: string, shippingCost: number): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ shipping_cost: shippingCost, updated_at: new Date().toISOString() })
    .eq('id', id);
  throwIfError(error);
}

export async function updateOrderNotes(id: string, adminNotes: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ admin_notes: adminNotes, updated_at: new Date().toISOString() })
    .eq('id', id);
  throwIfError(error);
}

export async function updateOrderItem(
  itemId: string,
  patch: { quantity?: number; unitPrice?: number },
): Promise<void> {
  const dbPatch: Record<string, any> = {};
  if (patch.quantity !== undefined) dbPatch.quantity = patch.quantity;
  if (patch.unitPrice !== undefined) dbPatch.unit_price = patch.unitPrice;
  const { error } = await supabase.from('order_items').update(dbPatch).eq('id', itemId);
  throwIfError(error);
}

export async function removeOrderItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('order_items').delete().eq('id', itemId);
  throwIfError(error);
}

export async function deleteOrder(id: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', id);
  throwIfError(error);
}

// ----------------------------------------------------------------------------
// Users / Team (admin only). No custom backend, so account creation uses an
// isolated Supabase Auth client (see supabaseClient.ts) to avoid hijacking
// the admin's own session. Deletion is a "soft delete" (disables the
// profile) since removing an Auth user permanently requires the service_role
// key, which must never live in frontend code.
// ----------------------------------------------------------------------------
export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  throwIfError(error);
  return (data || []).map(mapProfile);
}

export async function createTeamMember(params: {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}): Promise<User> {
  const isolated = createIsolatedClient();
  const { data, error } = await isolated.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: { full_name: params.fullName, role: params.role || 'member' },
    },
  });
  throwIfError(error);
  if (!data.user) throw new Error('Failed to create account');

  // The DB trigger (handle_new_user) already created the profile row from
  // raw_user_meta_data, but do a defensive update in case it raced ahead of it.
  await supabase
    .from('profiles')
    .update({ full_name: params.fullName, role: params.role || 'member' })
    .eq('id', data.user.id);

  return {
    id: data.user.id,
    email: params.email,
    fullName: params.fullName,
    role: params.role || 'member',
  };
}

export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  throwIfError(error);
}

export async function disableUser(id: string): Promise<void> {
  // Soft-delete: blocks the account via RLS (is_active()) without needing
  // the service_role key to remove the underlying Auth user.
  const { error } = await supabase.from('profiles').update({ disabled: true }).eq('id', id);
  throwIfError(error);
}
