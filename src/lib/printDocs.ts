import { Prescription } from '../models/types';
import { printDocument } from './print';
import { withDoctorTitle, KENYA_TZ, parseUtc } from './utils';

function looksLikeObjectId(value?: string | null): boolean {
  return Boolean(value && /^[a-f0-9]{24}$/i.test(value));
}

function displayName(value?: string | null, fallback = 'Unknown user'): string {
  if (!value || !value.trim()) return fallback;
  return looksLikeObjectId(value) ? fallback : value.trim();
}

function fmt(iso?: string): string {
  const d = parseUtc(iso);
  if (!d) return '-';
  return d.toLocaleString('en-GB', {
    timeZone: KENYA_TZ,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function fmtDate(iso?: string): string {
  const d = parseUtc(iso);
  if (!d) return '-';
  return d.toLocaleDateString('en-GB', {
    timeZone: KENYA_TZ,
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

export interface FollowUp {
  follow_up_date?: string;
  follow_up_instructions?: string;
}

function followUpSection(fu?: FollowUp): string {
  if (!fu || (!fu.follow_up_date && !fu.follow_up_instructions)) return '';
  const rows: string[] = [];
  if (fu.follow_up_date) {
    rows.push(`<div class="info-item"><label>Return On</label><span>${fmtDate(fu.follow_up_date)}</span></div>`);
  }
  if (fu.follow_up_instructions) {
    rows.push(`<div class="info-item" style="grid-column:1/-1"><label>Instructions</label><span style="font-weight:500">${fu.follow_up_instructions}</span></div>`);
  }
  return `
  <div class="section">
    <div class="section-title">Next / Follow-up Visit</div>
    <div class="followup">
      <div class="info-grid">${rows.join('')}</div>
    </div>
  </div>`;
}

const FOLLOWUP_STYLE = `
    .followup { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 10px 12px; }
    .followup .info-item label { color: #15803D; }
    .followup .info-item span { color: #14532D; }`;

export function printPrescription(rx: Prescription, followUp?: FollowUp): void {
  const rxNo = rx.rx_number ?? `RX-${rx.id.slice(0, 8).toUpperCase()}`;

  const medRows = rx.medications.map((m, i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;color:#94a3b8">${i + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">${m.name}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${m.dose ?? '-'}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${m.route ?? '-'}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${m.frequency ?? '-'}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${m.duration_days != null ? m.duration_days + ' days' : '-'}</td>
    </tr>`).join('');

  const body = `
  <style>
    .section { margin-bottom: 20px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-item label { font-size: 10px; color: #94a3b8; display: block; }
    .info-item span { font-weight: 600; }
    .meds { font-size: 12px; }
    .meds thead tr { background: #f8fafc; }
    .meds thead th { padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .meds thead th:last-child { text-align: right; }
    .notes { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #334155; }
    ${FOLLOWUP_STYLE}
  </style>

  <div class="section">
    <div class="section-title">Prescription Details</div>
    <div class="info-grid">
      <div class="info-item"><label>Patient</label><span>${displayName(rx.patient_name, 'Unknown Patient')}</span></div>
      <div class="info-item"><label>Prescribing Doctor</label><span>${withDoctorTitle(displayName(rx.doctor_name, 'Doctor'))}</span></div>
      <div class="info-item"><label>Date Ordered</label><span>${fmt(rx.ordered_at ?? rx.created_at)}</span></div>
      <div class="info-item"><label>Priority</label><span style="text-transform:capitalize">${rx.priority ?? 'Routine'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Medications</div>
    <table class="meds">
      <thead><tr>
        <th style="text-align:center">#</th><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th style="text-align:right">Duration</th>
      </tr></thead>
      <tbody>${medRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#94a3b8">No medications listed</td></tr>'}</tbody>
    </table>
  </div>

  ${rx.notes ? `
  <div class="section">
    <div class="section-title">Clinical Notes</div>
    <div class="notes">${rx.notes}</div>
  </div>` : ''}
  ${followUpSection(followUp)}`;

  printDocument({
    title: `Prescription - ${rxNo}`,
    documentLabel: 'PRESCRIPTION',
    reference: rxNo,
    body,
  });
}

export function printDispensingReceipt(rx: Prescription, followUp?: FollowUp): void {
  const rxNo = rx.rx_number ?? `RX-${rx.id.slice(0, 8).toUpperCase()}`;

  const medRows = rx.medications.map((m) => `
    <tr>
      <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-weight:600">${m.name}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${[m.dose, m.route, m.frequency, m.duration_days != null ? m.duration_days + 'd' : null].filter(Boolean).join(' · ')}</td>
    </tr>`).join('');

  const body = `
  <style>
    .section { margin-bottom: 18px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-item label { font-size: 10px; color: #94a3b8; display: block; }
    .info-item span { font-weight: 600; }
    .meds { font-size: 12px; }
    .meds thead th { padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; background: #f8fafc; }
    ${FOLLOWUP_STYLE}
  </style>

  <div class="section">
    <div class="info-grid">
      <div class="info-item"><label>Patient</label><span>${displayName(rx.patient_name, 'Unknown Patient')}</span></div>
      <div class="info-item"><label>Prescribing Doctor</label><span>${withDoctorTitle(displayName(rx.doctor_name, 'Doctor'))}</span></div>
      ${rx.auditor_name ? `<div class="info-item"><label>Auditor Approved By</label><span>${rx.auditor_name}</span></div>` : ''}
      <div class="info-item"><label>Dispensed</label><span>${fmt(rx.dispensed_at ?? rx.created_at)}</span></div>
      ${rx.dispensed_by_name ? `<div class="info-item"><label>Dispensed By</label><span>${rx.dispensed_by_name}</span></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Medications Dispensed</div>
    <table class="meds">
      <thead><tr><th>Medication</th><th>Directions</th></tr></thead>
      <tbody>${medRows}</tbody>
    </table>
  </div>
  ${followUpSection(followUp)}`;

  printDocument({
    title: `Dispensing Receipt - ${rxNo}`,
    documentLabel: 'DISPENSING RECEIPT',
    reference: rxNo,
    body,
  });
}
