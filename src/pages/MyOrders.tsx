import { useEffect, useState } from 'react';
import { fetchMyOrders, fetchOrder } from '../lib/api';
import { downloadOrderPdf } from '../lib/pdf';
import { Order } from '../types';
import { useAuth } from '../context/AuthContext';

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  reviewed: 'Reviewed',
  finalized: 'Finalized',
};

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    if (!user) return;
    try {
      setOrders(await fetchMyOrders(user.id));
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPdf(order: Order) {
    // Fetch the freshest copy right before generating, in case an Admin
    // changed shipping/quantities/items since this list was last loaded.
    try {
      const fresh = await fetchOrder(order.id);
      await downloadOrderPdf(fresh);
    } catch (e) {
      console.error('Failed to fetch latest order before generating PDF:', e);
      await downloadOrderPdf(order);
    }
  }

  function orderTotal(order: Order) {
    const subtotal = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    return subtotal + (order.shippingCost || 0);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Orders</h1>
          <p>Every order you've exported to the Admin.</p>
        </div>
      </div>

      {loading && <div className="empty-state">Loading orders...</div>}

      {!loading && orders.length === 0 && (
        <div className="empty-state">
          You haven't exported any orders yet. Add products to your cart and click "Export to PDF".
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id.slice(0, 8).toUpperCase()}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{order.items.length} product{order.items.length !== 1 ? 's' : ''}</td>
                  <td>{orderTotal(order).toFixed(2)} MAD</td>
                  <td>
                    <span className={`badge badge-${order.status}`}>
                      {statusLabel[order.status]}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDownloadPdf(order)}
                    >
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
