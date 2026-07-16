import { useEffect, useState } from 'react';
import {
  deleteOrder,
  fetchAllOrders,
  fetchOrder,
  removeOrderItem,
  updateOrderItem,
  updateOrderShipping,
  updateOrderStatus,
} from '../lib/api';
import { downloadOrderPdf } from '../lib/pdf';
import { Order, OrderStatus } from '../types';

const statusOptions: OrderStatus[] = ['pending', 'reviewed', 'finalized'];

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shippingDrafts, setShippingDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setOrders(await fetchAllOrders());
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function orderSubtotal(order: Order) {
    return order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    await updateOrderStatus(order.id, status);
    loadOrders();
  }

  async function handleShippingSave(order: Order) {
    const value = parseFloat(shippingDrafts[order.id] ?? String(order.shippingCost));
    if (isNaN(value)) return;
    await updateOrderShipping(order.id, value);
    await loadOrders();
  }

  async function handleItemQtyChange(order: Order, itemId: string, quantity: number) {
    if (quantity <= 0) return;
    await updateOrderItem(itemId, { quantity });
    await loadOrders();
  }

  async function handleRemoveItem(order: Order, itemId: string) {
    await removeOrderItem(itemId);
    await loadOrders();
  }

  async function handleDeleteOrder(order: Order) {
    const scrollY = window.scrollY;
    await deleteOrder(order.id);
    await loadOrders();
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }

  async function handleDownloadPdf(order: Order) {
    // Always pull the freshest copy of this exact order straight from the
    // database right before generating the PDF, instead of trusting
    // whatever's currently sitting in local component state. This removes
    // any chance of the PDF reflecting shipping/quantity/item edits that
    // haven't finished syncing into this page's state yet.
    try {
      const fresh = await fetchOrder(order.id);
      await downloadOrderPdf(fresh);
    } catch (e) {
      console.error('Failed to fetch latest order before generating PDF:', e);
      // Fall back to whatever we have locally rather than failing silently.
      await downloadOrderPdf(order);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>All Orders</h1>
          <p>Every order exported by the team. Review, adjust, and finalize before sending to the supplier.</p>
        </div>
      </div>

      {loading && <div className="empty-state">Loading orders...</div>}

      {!loading && orders.length === 0 && (
        <div className="empty-state">No orders have been exported yet.</div>
      )}

      {!loading &&
        orders.map((order) => {
          const isOpen = expanded === order.id;
          const subtotal = orderSubtotal(order);
          const total = subtotal + (order.shippingCost || 0);
          return (
            <div className="card" key={order.id} style={{ marginBottom: 16, padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
                onClick={() => setExpanded(isOpen ? null : order.id)}
              >
                <div>
                  <strong>#{order.id.slice(0, 8).toUpperCase()}</strong> &middot;{' '}
                  {order.user?.fullName || 'Unknown'} &middot;{' '}
                  {new Date(order.createdAt).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className={`badge badge-${order.status}`}>{order.status}</span>
                  <strong>{total.toFixed(2)} MAD</strong>
                  <span>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 16 }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.productName}</td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ width: 70 }}
                                defaultValue={item.quantity}
                                onBlur={(e) =>
                                  handleItemQtyChange(order, item.id, parseInt(e.target.value, 10))
                                }
                              />
                            </td>
                            <td>{item.unitPrice.toFixed(2)} MAD</td>
                            <td>{(item.unitPrice * item.quantity).toFixed(2)} MAD</td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleRemoveItem(order, item.id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: '0 0 200px' }}>
                      <label>Shipping Cost (MAD)</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="form-control"
                          type="number"
                          step="0.01"
                          defaultValue={order.shippingCost}
                          onChange={(e) =>
                            setShippingDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))
                          }
                        />
                        <button className="btn btn-secondary btn-sm" onClick={() => handleShippingSave(order)}>
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="form-group" style={{ flex: '0 0 220px' }}>
                      <label>Status</label>
                      <select
                        className="form-control"
                        value={order.status}
                        onChange={(e) => handleStatusChange(order, e.target.value as OrderStatus)}
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 16,
                    }}
                  >
                    <div style={{ fontSize: 14, color: '#6B7280' }}>
                      Subtotal: {subtotal.toFixed(2)} MAD &middot; Shipping:{' '}
                      {(order.shippingCost || 0).toFixed(2)} MAD &middot;{' '}
                      <strong style={{ color: '#0F1F3D' }}>Total: {total.toFixed(2)} MAD</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownloadPdf(order)}
                      >
                        Download PDF
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOrder(order)}>
                        Delete Order
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
