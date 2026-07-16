import { useEffect, useState } from 'react';
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  getExchangeRate,
  updateExchangeRate,
  updateProduct,
  uploadProductPhoto,
} from '../lib/api';
import { Product } from '../types';
import { useTheme } from '../context/ThemeContext';

const emptyForm = {
  id: '',
  name: '',
  priceRmb: '',
  reference: '',
  category: '',
  description: '',
  photoUrl: '',
  section: 'blue' as 'blue' | 'pink',
};

export default function AdminProducts() {
  const { section } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const [rate, setRate] = useState<number | null>(null);
  const [rateDraft, setRateDraft] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    loadProducts();
    loadRate();
  }, [section]);

  async function loadProducts() {
    setLoadError('');
    try {
      setProducts(await fetchProducts(section));
    } catch (e: any) {
      console.error('Failed to load products:', e);
      setLoadError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  async function loadRate() {
    try {
      const r = await getExchangeRate();
      setRate(r);
      setRateDraft(String(r));
    } catch (e) {
      console.error('Failed to load exchange rate:', e);
    }
  }

  async function saveRate() {
    const value = parseFloat(rateDraft);
    if (isNaN(value) || value <= 0) return;
    setRateSaving(true);
    try {
      const r = await updateExchangeRate(value);
      setRate(r);
      loadProducts(); // refresh so MAD prices reflect the new rate immediately
    } catch (e) {
      // ignore
    } finally {
      setRateSaving(false);
    }
  }

  function openCreate() {
    setForm({ ...emptyForm, section });
    setIsEditing(false);
    setError('');
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      priceRmb: String(product.priceRmb),
      reference: product.reference || '',
      category: product.category,
      description: product.description || '',
      photoUrl: product.photoUrl || '',
      section: product.section,
    });
    setIsEditing(true);
    setError('');
    setShowModal(true);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const photoUrl = await uploadProductPhoto(file);
      setForm((prev) => ({ ...prev, photoUrl }));
    } catch (e: any) {
      setError(e.message || 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name: form.name,
        priceRmb: parseFloat(form.priceRmb),
        reference: form.reference,
        category: form.category || 'Uncategorized',
        description: form.description,
        photoUrl: form.photoUrl,
        section: form.section,
      };
      if (isEditing) {
        await updateProduct(form.id, payload);
      } else {
        await createProduct(payload);
      }
      setShowModal(false);
      loadProducts();
    } catch (e: any) {
      console.error('Failed to save product:', e);
      setError(e.message || 'Failed to save product');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      loadProducts();
    } catch (e: any) {
      console.error('Failed to delete product:', e);
      setLoadError(e.message || 'Failed to delete product');
    }
  }

  const previewMad =
    form.priceRmb && rate ? (parseFloat(form.priceRmb) * rate).toFixed(2) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Manage Products</h1>
          <p>
            Add, edit, or remove products.{' '}
            <span className="section-pill">
              {section === 'pink' ? 'Cosmetics catalogue' : 'Electronics catalogue'}
            </span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Add Product
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20, maxWidth: 420 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
          Exchange Rate (1 RMB = ? MAD)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-control"
            type="number"
            step="0.0001"
            value={rateDraft}
            onChange={(e) => setRateDraft(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={saveRate} disabled={rateSaving}>
            {rateSaving ? 'Saving...' : 'Save Rate'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
          {rate !== null
            ? `Current rate: 1 RMB = ${rate} MAD. All product MAD prices are calculated from this rate automatically.`
            : 'Loading current rate...'}
        </p>
      </div>

      {loadError && <div className="error-banner">{loadError}</div>}

      {loading && <div className="empty-state">Loading products...</div>}

      {!loading && products.length === 0 && (
        <div className="empty-state">
          No products in this catalogue yet. Click "Add Product" to start it.
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Category</th>
                <th>Reference</th>
                <th>Price (RMB)</th>
                <th>Price (MAD)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    {product.photoUrl ? (
                      <img
                        src={product.photoUrl}
                        alt={product.name}
                        style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: '#F4F6FA' }} />
                    )}
                  </td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.reference || '-'}</td>
                  <td>¥{product.priceRmb.toFixed(2)}</td>
                  <td>{product.priceMad.toFixed(2)} MAD</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(product)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(product)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{isEditing ? 'Edit Product' : 'Add Product'}</h3>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Catalogue</label>
                <div className="section-toggle">
                  <button
                    type="button"
                    className={`section-toggle-btn${form.section === 'blue' ? ' active' : ''}`}
                    onClick={() => setForm({ ...form, section: 'blue' })}
                  >
                    Electronics
                  </button>
                  <button
                    type="button"
                    className={`section-toggle-btn pink${form.section === 'pink' ? ' active' : ''}`}
                    onClick={() => setForm({ ...form, section: 'pink' })}
                  >
                    Cosmetics
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Photo</label>
                {form.photoUrl && (
                  <img
                    src={form.photoUrl}
                    alt="preview"
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', marginBottom: 8 }}
                  />
                )}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                {uploading && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Uploading...</div>}
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price (RMB) ¥</label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.01"
                    value={form.priceRmb}
                    onChange={(e) => setForm({ ...form, priceRmb: e.target.value })}
                    required
                  />
                  {previewMad && (
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                      ≈ {previewMad} MAD at current rate
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input
                    className="form-control"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="anwa3 w kda"
                  />
                </div>
                <div className="form-group">
                  <label>Reference (optional)</label>
                  <input
                    className="form-control"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-control"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Product details, can be written in any language"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditing ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Product</h3>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
