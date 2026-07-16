import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';

export default function Layout() {
  const { user, logout } = useAuth();
  const { totalItems, openCart } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navItems = [
    { to: '/catalog', label: 'Catalog' },
    { to: '/my-orders', label: 'My Orders' },
    { to: '/admin/products', label: 'Manage Products' },
  ];

  if (user?.role === 'admin') {
    navItems.push(
      { to: '/admin/orders', label: 'All Orders' },
      { to: '/admin/team', label: 'Team' },
    );
  }

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <img src="/logo.jpeg" alt="Xplore" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="icon-btn" onClick={openCart}>
            Cart {totalItems > 0 && `(${totalItems})`}
          </button>
          <button className="icon-btn" onClick={() => setMenuOpen(true)}>
            {user?.fullName?.split(' ')[0] || 'Account'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="modal-overlay" onClick={() => setMenuOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 320 }}>
            <h3>{user?.fullName}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -8 }}>
              {user?.email} &middot; {user?.role}
            </p>
            <div className="modal-actions" style={{ justifyContent: 'stretch' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setMenuOpen(false)}
              >
                Close
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.jpeg" alt="Xplore" />
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user?.fullName}</strong>
            {user?.email} &middot; {user?.role}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav-link${isActive ? ' active' : ''}`}
          >
            <span className="dot" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <CartDrawer />
    </div>
  );
}
