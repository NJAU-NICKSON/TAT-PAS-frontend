import React, { useState, ChangeEvent } from 'react';
import { Search, Plus, X, CreditCard as Edit2, User } from 'lucide-react';
import Table, { Column } from '../components/Table';
import TablePagination from '../components/TablePagination';
import { useTableControls } from '../components/useTableControls';
import FormField from '../components/FormField';
import { usePatientViewModel } from '../viewModels/usePatientViewModel';
import { Patient, ApiError, Allergy } from '../models/types';
import { patientsApi, CreatePatientPayload, UpdatePatientPayload } from '../api/patients';

interface PatientFormData {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  national_id: string;
  guardian_national_id: string;
  guardian_name: string;
  phone: string;
  address: string;
  allergies: Allergy[];
}

const emptyForm: PatientFormData = {
  first_name: '',
  last_name: '',
  dob: '',
  gender: '',
  national_id: '',
  guardian_national_id: '',
  guardian_name: '',
  phone: '',
  address: '',
  allergies: [],
};

interface FormErrors {
  first_name?: string;
  last_name?: string;
  national_id?: string;
  guardian_national_id?: string;
}

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function isValidNationalId(v: string): boolean {
  return /^\d{7,8}$/.test(v.trim());
}

export default function PatientFormPage() {
  const vm = usePatientViewModel();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<PatientFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [newAllergy, setNewAllergy] = useState('');
  const [newSeverity, setNewSeverity] = useState<Allergy['severity']>('moderate');

  const addAllergy = () => {
    const substance = newAllergy.trim();
    if (!substance) return;
    if (formData.allergies.some(a => a.substance.toLowerCase() === substance.toLowerCase())) {
      setNewAllergy('');
      return;
    }
    setFormData(prev => ({
      ...prev,
      allergies: [...prev.allergies, { substance, severity: newSeverity }],
    }));
    setNewAllergy('');
    setNewSeverity('moderate');
  };

  const removeAllergy = (idx: number) => {
    setFormData(prev => ({ ...prev, allergies: prev.allergies.filter((_, i) => i !== idx) }));
  };

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
      dob: patient.dob ? patient.dob.slice(0, 10) : '',
      gender: patient.gender ?? '',
      national_id: patient.national_id ?? '',
      guardian_national_id: patient.guardian_national_id ?? '',
      guardian_name: patient.guardian_name ?? '',
      phone: patient.contact?.phone ?? '',
      address: patient.contact?.address ?? '',
      allergies: patient.allergies ?? [],
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

    const age = ageFromDob(formData.dob);
    const isMinor = age !== null && age < 18;

    if (isMinor) {
      if (!formData.guardian_national_id.trim()) {
        errors.guardian_national_id = 'Guardian National ID is required for under-18 patients';
      } else if (!isValidNationalId(formData.guardian_national_id)) {
        errors.guardian_national_id = 'National ID must be 7-8 digits';
      }
    } else {
      if (!formData.national_id.trim()) {
        errors.national_id = 'National ID is required for patients aged 18 and above';
      } else if (!isValidNationalId(formData.national_id)) {
        errors.national_id = 'National ID must be 7-8 digits';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError(null);

    const trimmedPhone = formData.phone.trim();
    const trimmedAddress = formData.address.trim();
    const hasContact = Boolean(trimmedPhone || trimmedAddress);

    const age = ageFromDob(formData.dob);
    const isMinor = age !== null && age < 18;

    const payload: CreatePatientPayload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      ...(formData.dob ? { dob: formData.dob } : {}),
      ...(formData.gender ? { gender: formData.gender } : {}),
      ...(isMinor
        ? {
            guardian_national_id: formData.guardian_national_id.trim(),
            ...(formData.guardian_name.trim() ? { guardian_name: formData.guardian_name.trim() } : {}),
          }
        : { national_id: formData.national_id.trim() }),
      ...(hasContact
        ? {
            contact: {
              ...(trimmedPhone ? { phone: trimmedPhone } : {}),
              ...(trimmedAddress ? { address: trimmedAddress } : {}),
            },
          }
        : {}),
      ...(formData.allergies.length > 0 ? { allergies: formData.allergies } : {}),
    };

    if (editingPatient) {
      const updatePayload: UpdatePatientPayload = payload;
      const updated = await vm.updatePatient(editingPatient.id, updatePayload);
      if (updated) closeModal();
      else setSubmitError(vm.error ?? 'Could not save the patient. Please try again.');
      return;
    }

    await submitCreate(payload, false);
  };

  const submitCreate = async (payload: CreatePatientPayload, force: boolean) => {
    try {
      const res = await patientsApi.create(payload, force);
      vm.absorbCreated(res.data);
      closeModal();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.code === 'POSSIBLE_DUPLICATE_PATIENT' && !force) {
        const existingMrn = (apiErr.data?.existing_mrn as string) ?? '';
        const proceed = window.confirm(
          `${apiErr.detail}\n\nRegister this patient anyway as a separate record?`
        );
        if (proceed) {
          await submitCreate(payload, true);
        } else {
          setSubmitError(
            `A matching patient already exists${existingMrn ? ` (MRN ${existingMrn})` : ''}. ` +
            `Search for them in the patient list instead of creating a duplicate.`
          );
        }
        return;
      }
      setSubmitError(apiErr?.detail ?? 'Could not save the patient. Please try again.');
    }
  };

  const tc = useTableControls<Patient>({
    data: vm.patients,
    initialSortKey: 'name',
    getSortValue: (row, key) => {
      if (key === 'name') return `${row.first_name} ${row.last_name}`;
      if (key === 'phone') return row.contact?.phone;
      if (key === 'national_id') return row.national_id ?? row.guardian_national_id;
      return (row as unknown as Record<string, unknown>)[key];
    },
  });

  const columns: Column<Patient>[] = [
    { key: 'mrn', label: 'MRN', sortable: true },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => `${row.first_name} ${row.last_name}`,
    },
    {
      key: 'national_id',
      label: 'National ID',
      sortable: true,
      render: (row) =>
        row.national_id
          ? row.national_id
          : row.guardian_national_id
            ? <span className="text-gray-500">Guardian: {row.guardian_national_id}</span>
            : <span className="text-gray-400">N/A</span>,
    },
    {
      key: 'dob',
      label: 'Date of Birth',
      sortable: true,
      render: (row) => row.dob ?? 'N/A',
    },
    {
      key: 'gender',
      label: 'Gender',
      sortable: true,
      render: (row) => row.gender ? <span className="capitalize">{row.gender}</span> : <span className="text-gray-400">N/A</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: true,
      render: (row) => row.contact?.phone ?? 'N/A',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); openEditPatient(row); }}
          className="flex items-center gap-1 text-[var(--clinical-600)] hover:opacity-80 text-sm font-medium transition-colors"
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
          className="flex items-center gap-2 bg-[var(--clinical-600)] hover:opacity-90 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
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
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clinical-600)] focus:border-transparent"
        />
      </div>

      {vm.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {vm.error}
        </div>
      )}

      <div>
        <Table
          columns={columns}
          data={tc.pageRows}
          isLoading={vm.isLoading}
          emptyMessage="No patients found. Try a different search or add a new patient."
          onRowClick={openEditPatient}
          sortKey={tc.sortKey}
          sortDir={tc.sortDir}
          onSort={tc.toggleSort}
        />
        {!vm.isLoading && vm.patients.length > 0 && (
          <TablePagination
            page={tc.page} pageCount={tc.pageCount} pageSize={tc.pageSize}
            total={tc.total} rangeStart={tc.rangeStart} rangeEnd={tc.rangeEnd}
            setPage={tc.setPage} setPageSize={tc.setPageSize}
          />
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div role="dialog" aria-modal="true" className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-[var(--clinical-600)]" />
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
                  ]}
                  placeholder="Select gender"
                />
              </div>

              {(() => {
                const age = ageFromDob(formData.dob);
                const isMinor = age !== null && age < 18;
                return isMinor ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <FormField
                      label="Guardian National ID"
                      name="guardian_national_id"
                      type="text"
                      value={formData.guardian_national_id}
                      onChange={handleChange}
                      error={formErrors.guardian_national_id}
                      required
                      placeholder="7-8 digits"
                    />
                    <FormField
                      label="Guardian Name"
                      name="guardian_name"
                      type="text"
                      value={formData.guardian_name}
                      onChange={handleChange}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                ) : (
                  <FormField
                    label="National ID"
                    name="national_id"
                    type="text"
                    value={formData.national_id}
                    onChange={handleChange}
                    error={formErrors.national_id}
                    required
                    placeholder="7-8 digits"
                  />
                );
              })()}

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
                placeholder="Street address, estate, Nairobi..."
                rows={2}
              />

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Allergies</label>

                {formData.allergies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.allergies.map((a, idx) => (
                      <span
                        key={`${a.substance}-${idx}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
                      >
                        {a.substance} <span className="opacity-70">({a.severity})</span>
                        <button type="button" onClick={() => removeAllergy(idx)} className="hover:opacity-70" aria-label={`Remove ${a.substance}`}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAllergy}
                    onChange={e => setNewAllergy(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }}
                    placeholder="e.g. Penicillin"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clinical-600)]"
                  />
                  <select
                    value={newSeverity}
                    onChange={e => setNewSeverity(e.target.value as Allergy['severity'])}
                    className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clinical-600)]"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                  <button
                    type="button"
                    onClick={addAllergy}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--clinical-600)] hover:opacity-90"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Press Enter or click Add. Severe allergies trigger clinical safety flags on prescriptions.</p>
              </div>

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
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--clinical-600)] hover:opacity-90 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
