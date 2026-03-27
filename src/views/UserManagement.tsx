import React, { useState, useEffect, ChangeEvent } from 'react';
import { Plus, CreditCard as Edit2, X, Users, Loader as Loader2, AlertCircle } from 'lucide-react';
import Table, { Column } from '../components/Table';
import FormField from '../components/FormField';
import { RoleBadge } from '../components/StatusBadge';
import { usersApi, CreateUserPayload, UpdateUserPayload } from '../api/users';
import { User, UserRole, ApiError } from '../models/types';

const ROLE_OPTIONS = [
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'admin', label: 'Admin' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'billing', label: 'Billing' },
  { value: 'auditor', label: 'Auditor' },
];

interface UserFormData {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role: UserRole | '';
}

interface FormErrors {
  username?: string;
  full_name?: string;
  email?: string;
  password?: string;
  role?: string;
}

const emptyForm: UserFormData = {
  username: '',
  full_name: '',
  email: '',
  password: '',
  role: '',
};

function formatDate(iso?: string): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString();
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await usersApi.list();
      const items = Array.isArray(res.data) ? res.data : (res.data as { items?: User[] }).items ?? [];
      setUsers(items);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.detail || 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openNewUser = () => {
    setEditingUser(null);
    setFormData(emptyForm);
    setFormErrors({});
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
    });
    setFormErrors({});
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData(emptyForm);
    setFormErrors({});
    setSubmitError(null);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (!editingUser && !formData.password) errors.password = 'Password is required for new users';
    if (!formData.role) errors.role = 'Role is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (editingUser) {
        const payload: UpdateUserPayload = {
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          role: formData.role as UserRole,
        };
        if (formData.password) {
          payload.password = formData.password;
        }
        const res = await usersApi.update(editingUser.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data : u)));
      } else {
        const payload: CreateUserPayload = {
          username: formData.username.trim(),
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role as UserRole,
        };
        const res = await usersApi.create(payload);
        setUsers((prev) => [res.data, ...prev]);
      }
      closeModal();
    } catch (err) {
      const apiErr = err as ApiError;
      setSubmitError(apiErr?.detail || 'Failed to save user.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<User>[] = [
    { key: 'username', label: 'Username' },
    { key: 'full_name', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (row) => <RoleBadge role={row.role} />,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row) => formatDate(row.created_at),
    },
    {
      key: 'last_login',
      label: 'Last Login',
      render: (row) => formatDate(row.last_login),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); openEditUser(row); }}
          className="flex items-center gap-1 text-[#1e3a5f] hover:text-blue-700 text-sm font-medium transition-colors"
        >
          <Edit2 className="h-4 w-4" />
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage system users and their roles</p>
        </div>
        <button
          onClick={openNewUser}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New User
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <Table
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No users found."
        onRowClick={openEditUser}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingUser ? 'Edit User' : 'New User'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6">
              {submitError && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {submitError}
                </div>
              )}

              <FormField
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                error={formErrors.username}
                required
                placeholder="e.g. john.doe"
                disabled={!!editingUser}
              />
              <FormField
                label="Full Name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                error={formErrors.full_name}
                required
                placeholder="e.g. John Doe"
              />
              <FormField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={formErrors.email}
                required
                placeholder="e.g. john@hospital.org"
              />
              <FormField
                label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                error={formErrors.password}
                required={!editingUser}
                placeholder={editingUser ? 'Leave blank to keep current password' : 'Set a password'}
              />
              <FormField
                label="Role"
                name="role"
                type="select"
                value={formData.role}
                onChange={handleChange}
                error={formErrors.role}
                required
                options={ROLE_OPTIONS}
                placeholder="Select a role"
              />

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e3a5f] hover:bg-[#162d4a] text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
