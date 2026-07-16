import { useEffect, useState } from 'react';
import { createTeamMember, deleteUser, fetchUsers, updateUserRole } from '../lib/api';
import { User, UserRole } from '../types';

const emptyForm = { email: '', password: '', fullName: '', role: 'member' as UserRole };

export default function AdminTeam() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      setUsers(await fetchUsers());
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createTeamMember(form);
      setShowModal(false);
      loadUsers();
    } catch (e: any) {
      setError(e.message || 'Failed to create account');
    }
  }

  async function handleRoleToggle(user: User) {
    const newRole: UserRole = user.role === 'admin' ? 'member' : 'admin';
    await updateUserRole(user.id, newRole);
    loadUsers();
  }

  async function handleDeleteClick(user: User) {
    const ok = window.confirm(
      `Permanently delete ${user.fullName} (${user.email})? This cannot be undone.`,
    );
    if (!ok) return;

    setRowError(null);
    setBusyId(user.id);
    try {
      await deleteUser(user.id);
      loadUsers();
    } catch (e: any) {
      setRowError({ id: user.id, message: e?.message || 'Failed to delete user' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Team</h1>
          <p>Create accounts for team members. There is no public registration.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Add Team Member
        </button>
      </div>

      {loading && <div className="empty-state">Loading team...</div>}

      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge badge-${user.role}`}>{user.role}</span>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRoleToggle(user)}>
                        Make {user.role === 'admin' ? 'Member' : 'Admin'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busyId === user.id}
                        onClick={() => handleDeleteClick(user)}
                      >
                        {busyId === user.id ? 'Deleting...' : 'Delete'}
                      </button>
                      {rowError?.id === user.id && (
                        <span style={{ color: 'var(--danger)', fontSize: 12 }}>{rowError.message}</span>
                      )}
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
            <h3>Add Team Member</h3>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  className="form-control"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  className="form-control"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Temporary Password</label>
                <input
                  className="form-control"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  className="form-control"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
