import React, { useState, ChangeEvent } from 'react';
import { Search, Plus, X, CreditCard as Edit2, User } from 'lucide-react';
import Table, { Column } from '../components/Table';
import FormField from '../components/FormField';
import { usePatientViewModel } from '../viewModels/usePatientViewModel';
import { Patient } from '../models/types';
import { CreatePatientPayload, UpdatePatientPayload } from '../api/patients';

interface PatientFormData {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
}

const emptyForm: PatientFormData = {
  first_name: '',
  last_name: '',
  dob: '',
  gender: '',
  phone: '',
  address: '',
};

interface FormErrors {
  first_name?: string;
  last_name?: string;
}

export default function PatientFormPage() {
  const vm = usePatientViewModel();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<PatientFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const openNewPatient = () => {
    setEditingPatient(null);
    setFormData(emptyForm);
    setFormErrors({});
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const openEditPatient = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      first_name: patient.first_name,
      last_name: patient.last_name,
      dob: patient.dob ?? '',
      gender: patient.gender ?? '',
      phone: patient.contact?.phone ?? '',
      address: patient.contact?.address ?? '',
    });
    setFormErrors({});
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPatient(null);
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
    if (!formData.first_name.trim()) errors.first_name = 'First name is required';
    if (!formData.last_name.trim()) errors.last_name = 'Last name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError(null);

    const payload: CreatePatientPayload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      dob: formData.dob || undefined,
      gender: formData.gender || undefined,
      contact: {
        phone: formData.phone || undefined,
        address: formData.address || undefined,
      },
    };

    let result: Patient | null = null;
    if (editingPatient) {
      const updatePayload: UpdatePatientPayload = payload;
      result = await vm.updatePatient(editingPatient.id, updatePayload);
    } else {
      result = await vm.createPatient(payload);
    }

    if (result) {
      closeModal();
    } else if (vm.error) {
      setSubmitError(vm.error);
    }
  };

  const columns: Column<Patient>[] = [
    { key: 'mrn', label: 'MRN' },
    {
      key: 'name',
      label: 'Name',
      render: (row) => `${row.first_name} ${row.last_name}`,
    },
    {
      key: 'dob',
      label: 'Date of Birth',
      render: (row) => row.dob ?? 'N/A',
    },
    {
      key: 'gender',
      label: 'Gender',
      render: (row) => row.gender ? <span className="capitalize">{row.gender}</span> : <span className="text-gray-400">N/A</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (row) => row.contact?.phone ?? 'N/A',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); openEditPatient(row); }}
          className="flex items-center gap-1 text-[#1e3a5f] hover:text-blue-700 text-sm font-medium transition-colors"
          title="Edit patient"
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
          <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
          <p className="text-gray-500 text-sm mt-1">Search, add, and manage patient records</p>
        </div>
        <button
          onClick={openNewPatient}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Patient
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or MRN..."
          value={vm.searchQuery}
          onChange={(e) => vm.setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        />
      </div>

      {vm.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {vm.error}
        </div>
      )}

      <Table
        columns={columns}
        data={vm.patients}
        isLoading={vm.isLoading}
        emptyMessage="No patients found. Try a different search or add a new patient."
        onRowClick={openEditPatient}
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
                <User className="h-5 w-5 text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingPatient ? 'Edit Patient' : 'New Patient'}
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
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <FormField
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  error={formErrors.first_name}
                  required
                  placeholder="e.g. John"
                />
                <FormField
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  error={formErrors.last_name}
                  required
                  placeholder="e.g. Doe"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <FormField
                  label="Date of Birth"
                  name="dob"
                  type="date"
                  value={formData.dob}
                  onChange={handleChange}
                />
                <FormField
                  label="Gender"
                  name="gender"
                  type="select"
                  value={formData.gender}
                  onChange={handleChange}
                  options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                  ]}
                  placeholder="Select gender"
                />
              </div>

              <FormField
                label="Phone Number"
                name="phone"
                type="text"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. +1 555-555-5555"
              />
              <FormField
                label="Address"
                name="address"
                type="textarea"
                value={formData.address}
                onChange={handleChange}
                placeholder="Street address, city, state..."
                rows={2}
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
                  disabled={vm.isLoading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e3a5f] hover:bg-[#162d4a] text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {vm.isLoading ? 'Saving...' : editingPatient ? 'Save Changes' : 'Create Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
