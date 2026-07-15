import { useEffect, useState } from 'react';
import { fetchProductCategories, fetchProducts } from '../lib/api';
import { Product } from '../types';
import { useCart } from '../context/CartContext';

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const { addToCart, openCart } = useCart();

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts(activeCategory);
  }, [activeCategory]);

  async function loadCategories() {
    try {
      setCategories(await fetchProductCategories());
    } catch (e) {
      // ignore
    }
  }

  async function loadProducts(category: string) {
    setLoading(true);
    try {
      setProducts(await fetchProducts(category));
    } catch (e) {
      // ignore
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
    openCart();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Product Catalog</h1>
          <p>Browse available products and build your order.</p>
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

      {loading && <div className="empty-state">Loading products...</div>}

      {!loading && products.length === 0 && (
        <div className="empty-state">
          No products yet. Ask your Admin to add some to the catalog.
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
