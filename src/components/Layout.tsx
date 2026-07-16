import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import CartDrawer from './CartDrawer';

function SectionSwitch({ compact }: { compact?: boolean }) {
  const { section, setSection } = useTheme();
  const isPink = section === 'pink';
  return (
    <button
      type="button"
      className={`mode-toggle${compact ? ' compact' : ''}`}
      aria-pressed={isPink}
      aria-label="Switch between electronics and cosmetics catalogue"
      onClick={() => setSection(isPink ? 'blue' : 'pink')}
    >
      <span className={`mode-toggle-label${!isPink ? ' active' : ''}`}>Electronics</span>
      <span className="mode-toggle-track" data-active={section}>
        <span className="mode-toggle-thumb">
          <svg className="mode-toggle-icon icon-bolt" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
          <svg className="mode-toggle-icon icon-heart" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-7.2-4.6-9.8-9.1C.6 8.6 1.8 5 5.2 4.1c2-.5 3.9.3 5.1 1.9C11.5 4.4 13.4 3.6 15.4 4.1c3.4.9 4.6 4.5 3 7.8C19.2 16.4 12 21 12 21z" />
          </svg>
        </span>
      </span>
      <span className={`mode-toggle-label${isPink ? ' active' : ''}`}>Cosmetics</span>
    </button>
  );
}

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
        <img src="/f60d2570-cf96-42a4-b024-9bddf61edb2b_20260716_035810_0000.png" alt="Xplore" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="icon-btn" onClick={openCart}>
            Cart {totalItems > 0 && `(${totalItems})`}
          </button>
          <button className="icon-btn" onClick={() => setMenuOpen(true)}>
            {user?.fullName?.split(' ')[0] || 'Account'}
          </button>
        </div>
      </div>
      <div className="mobile-section-bar">
        <SectionSwitch compact />
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
        <div className="sidebar-section-row">
          <SectionSwitch />
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
