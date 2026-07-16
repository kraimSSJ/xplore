import { useEffect, useState } from 'react';
import { fetchProductCategories, fetchProducts } from '../lib/api';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';

export default function Catalog() {
  const { section } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const { addToCart } = useCart();

  // Categories are scoped to the active catalogue (blue/electronics vs
  // pink/cosmetics), so reset the filter whenever the section switches.
  useEffect(() => {
    setActiveCategory('all');
    loadCategories(section);
  }, [section]);

  useEffect(() => {
    loadProducts(section, activeCategory);
  }, [section, activeCategory]);

  async function loadCategories(sec: typeof section) {
    try {
      setCategories(await fetchProductCategories(sec));
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }

  async function loadProducts(sec: typeof section, category: string) {
    setLoadError('');
    try {
      const results = await fetchProducts(sec, category);
      setProducts(results);
    } catch (e: any) {
      console.error('Failed to load products:', e);
      setLoadError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  function getQty(id: string) {
    return qtyMap[id] || 1;
  }

  function setQty(id: string, value: number) {
    setQtyMap((prev) => ({ ...prev, [id]: Math.max(1, value) }));
  }

  function handleAdd(product: Product) {
    addToCart(product, getQty(product.id));
    setQtyMap((prev) => ({ ...prev, [product.id]: 1 }));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Product Catalog</h1>
          <p>
            Browse available products and build your order.{' '}
            <span className="section-pill">{section === 'pink' ? 'Cosmetics' : 'Electronics'}</span>
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <button
          className={`chip${activeCategory === 'all' ? ' active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`chip${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loadError && <div className="error-banner">{loadError}</div>}

      {loading && <div className="empty-state">Loading products...</div>}

      {!loading && products.length === 0 && (
        <div className="empty-state">
          No {section === 'pink' ? 'cosmetics' : 'electronics'} products yet. Ask your Admin to add
          some to this catalogue.
        </div>
      )}

      <div className="product-grid">
        {products.map((product) => (
          <div className="product-card" key={product.id}>
            <div className="product-photo">
              {product.photoUrl ? (
                <img src={product.photoUrl} alt={product.name} />
              ) : (
                <span className="product-photo-placeholder">No photo</span>
              )}
            </div>
            <div className="product-body">
              <span className="product-category">{product.category}</span>
              <span className="product-name">{product.name}</span>
              {product.reference && (
                <span className="product-ref">Ref: {product.reference}</span>
              )}
              {product.description && (
                <span className="product-desc">{product.description}</span>
              )}
              <div className="product-footer">
                <span className="product-price">¥{product.priceRmb.toFixed(2)}</span>
                <span className="product-price-mad">≈ {product.priceMad.toFixed(2)} MAD</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <div className="qty-stepper">
                  <button onClick={() => setQty(product.id, getQty(product.id) - 1)}>-</button>
                  <span>{getQty(product.id)}</span>
                  <button onClick={() => setQty(product.id, getQty(product.id) + 1)}>+</button>
                </div>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleAdd(product)}>
                  Add to cart
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
