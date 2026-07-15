import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';

export default function Layout() {
  const { user, logout } = useAuth();
  const { totalItems, openCart } = useCart();
  const navigate = useNavigate();

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
        <button className="icon-btn" onClick={openCart} style={{ color: '#fff', position: 'relative' }}>
          Cart {totalItems > 0 && `(${totalItems})`}
        </button>
      </div>

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

      <CartDrawer />
    </div>
  );
}