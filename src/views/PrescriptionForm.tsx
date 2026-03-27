import React, { useState, ChangeEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, AlertTriangle, Search, Loader as Loader2, CheckCircle } from 'lucide-react';
import FormField from '../components/FormField';
import { usePrescriptionViewModel } from '../viewModels/usePrescriptionViewModel';
import { usePatientViewModel } from '../viewModels/usePatientViewModel';
import { MedicationItem } from '../models/types';

const ROUTES = [
  { value: 'oral', label: 'Oral' },
  { value: 'IV', label: 'IV (Intravenous)' },
  { value: 'IM', label: 'IM (Intramuscular)' },
  { value: 'topical', label: 'Topical' },
  { value: 'subcutaneous', label: 'Subcutaneous' },
];

const FREQUENCIES = [
  { value: 'once daily', label: 'Once Daily' },
  { value: 'twice daily', label: 'Twice Daily' },
  { value: 'three times daily', label: 'Three Times Daily' },
  { value: 'four times daily', label: 'Four Times Daily' },
  { value: 'as needed', label: 'As Needed (PRN)' },
];

const emptyMedication = (): MedicationItem => ({
  name: '',
  dose: '',
  route: '',
  frequency: '',
  duration_days: 1,
});

interface MedErrors {
  name?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration_days?: string;
}

interface FormErrors {
  patient?: string;
  medications?: string;
  meds?: MedErrors[];
}

function parseDose(dose: string): number {
  const match = dose.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

export default function PrescriptionFormPage() {
  const navigate = useNavigate();
  const prescriptionVm = usePrescriptionViewModel();
  const patientVm = usePatientViewModel();

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [medications, setMedications] = useState<MedicationItem[]>([emptyMedication()]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (patientSearch.length > 0) {
      patientVm.setSearchQuery(patientSearch);
      setShowPatientDropdown(true);
    } else {
      setShowPatientDropdown(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientSearch]);

  const selectPatient = (id: string, name: string) => {
    setSelectedPatientId(id);
    setPatientSearch(name);
    setShowPatientDropdown(false);
    if (errors.patient) setErrors((prev) => ({ ...prev, patient: undefined }));
  };

  const addMedication = () => {
    setMedications((prev) => [...prev, emptyMedication()]);
  };

  const removeMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof MedicationItem, value: string | number) => {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? { ...med, [field]: value } : med))
    );
    // Clear specific field error
    if (errors.meds?.[index]) {
      setErrors((prev) => {
        const newMeds = [...(prev.meds ?? [])];
        if (newMeds[index]) {
          newMeds[index] = { ...newMeds[index], [field]: undefined };
        }
        return { ...prev, meds: newMeds };
      });
    }
  };

  const handleMedChange = (
    index: number,
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const fieldName = name.replace(`_${index}`, '') as keyof MedicationItem;
    if (fieldName === 'duration_days') {
      updateMedication(index, fieldName, parseInt(value, 10) || 1);
    } else {
      updateMedication(index, fieldName, value);
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!selectedPatientId) newErrors.patient = 'Please select a patient';
    if (medications.length === 0) newErrors.medications = 'At least one medication is required';

    const medErrors: MedErrors[] = medications.map((med) => {
      const e: MedErrors = {};
      if (!med.name.trim()) e.name = 'Required';
      if (!med.dose.trim()) e.dose = 'Required';
      if (!med.route) e.route = 'Required';
      if (!med.frequency) e.frequency = 'Required';
      if (!med.duration_days || med.duration_days < 1) e.duration_days = 'Must be at least 1';
      return e;
    });

    const hasMedErrors = medErrors.some((e) => Object.keys(e).length > 0);
    if (hasMedErrors) newErrors.meds = medErrors;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const result = await prescriptionVm.createPrescription({
      patient_id: selectedPatientId,
      medications,
      notes: notes.trim() || undefined,
    });

    if (result) {
      setSuccess(true);
      setTimeout(() => navigate('/prescriptions'), 1500);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Prescription Created</h2>
        <p className="text-gray-500 text-sm">Redirecting to prescriptions list...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Prescription</h1>
        <p className="text-gray-500 text-sm mt-1">Create a new prescription order for a patient</p>
      </div>

      {prescriptionVm.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {prescriptionVm.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Patient</h2>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Patient <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Type patient name or MRN..."
                className={`w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent ${
                  errors.patient ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
                onFocus={() => patientSearch && setShowPatientDropdown(true)}
              />
            </div>
            {errors.patient && (
              <p className="mt-1 text-xs text-red-600">{errors.patient}</p>
            )}

            {showPatientDropdown && patientVm.patients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {patientVm.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : (
                  patientVm.patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p.id, `${p.first_name} ${p.last_name}`)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm"
                    >
                      <span className="font-medium text-gray-800">
                        {p.first_name} {p.last_name}
                      </span>
                      <span className="text-gray-400 ml-2 text-xs">MRN: {p.mrn}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedPatientId && (
              <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Patient selected
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Medications</h2>
            <button
              type="button"
              onClick={addMedication}
              className="flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:text-blue-700 font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Medication
            </button>
          </div>

          {errors.medications && (
            <p className="mb-3 text-xs text-red-600">{errors.medications}</p>
          )}

          <div className="space-y-6">
            {medications.map((med, index) => {
              const medErr = errors.meds?.[index] ?? {};
              const doseNum = parseDose(med.dose);
              const showHighDoseWarning = doseNum > 1000;

              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-600">
                      Medication #{index + 1}
                    </span>
                    {medications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedication(index)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Remove medication"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <FormField
                      label="Medication Name"
                      name={`name_${index}`}
                      value={med.name}
                      onChange={(e) => handleMedChange(index, e)}
                      error={medErr.name}
                      required
                      placeholder="e.g. Amoxicillin"
                    />
                    <div>
                      <FormField
                        label="Dose"
                        name={`dose_${index}`}
                        value={med.dose}
                        onChange={(e) => handleMedChange(index, e)}
                        error={medErr.dose}
                        required
                        placeholder="e.g. 500mg"
                      />
                      {showHighDoseWarning && (
                        <div className="flex items-center gap-1.5 -mt-2 mb-3 text-amber-600 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>High dose - will trigger automated audit</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
                    <FormField
                      label="Route"
                      name={`route_${index}`}
                      type="select"
                      value={med.route}
                      onChange={(e) => handleMedChange(index, e)}
                      error={medErr.route}
                      required
                      options={ROUTES}
                      placeholder="Select route"
                    />
                    <FormField
                      label="Frequency"
                      name={`frequency_${index}`}
                      type="select"
                      value={med.frequency}
                      onChange={(e) => handleMedChange(index, e)}
                      error={medErr.frequency}
                      required
                      options={FREQUENCIES}
                      placeholder="Select frequency"
                    />
                    <FormField
                      label="Duration (days)"
                      name={`duration_days_${index}`}
                      type="number"
                      value={med.duration_days}
                      onChange={(e) => handleMedChange(index, e)}
                      error={medErr.duration_days}
                      required
                      min={1}
                      max={365}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Notes</h2>
          <FormField
            label="Clinical Notes"
            name="notes"
            type="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special instructions or clinical notes..."
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/prescriptions')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={prescriptionVm.isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1e3a5f] hover:bg-[#162d4a] text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {prescriptionVm.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {prescriptionVm.isLoading ? 'Submitting...' : 'Submit Prescription'}
          </button>
        </div>
      </form>
    </div>
  );
}
