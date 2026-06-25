import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, CheckCircle, AlertTriangle, Loader2, Search, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { SeverityBadge, TypeBadge } from '../components/StatusBadge';
import {
  auditsApi,
  IntegrityResult,
  PrescriptionIntegrityResult,
  IntegrityTrailRecord,
} from '../api/audits';
import { getErrorMessage } from '../lib/utils';

function fmt(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

function Field({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">{label}</p>
      <p className={`text-xs text-gray-800 break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function TrailRecord({ rec, index }: { rec: IntegrityTrailRecord; index: number }) {
  return (
    <div className="px-5 py-4 break-inside-avoid">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
          {rec.type && <TypeBadge type={rec.type} />}
          {rec.severity && <SeverityBadge severity={rec.severity} />}
          {rec.flag_code && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{rec.flag_code}</span>
          )}
          {rec.is_security_event && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">SECURITY</span>
          )}
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            rec.verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {rec.verified ? 'Hash verified' : `FAILED: ${rec.problem ?? 'invalid'}`}
        </span>
      </div>

      <p className="text-sm text-gray-900 font-medium mt-2">{rec.issue}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 mt-3">
        <Field label="Record ID" value={rec.id} mono />
        <Field label="Created" value={fmt(rec.created_at)} />
        <Field label="Created by" value={`${rec.created_by_role ?? '-'}${rec.created_by ? ` (${rec.created_by})` : ''}`} />
        <Field label="Drug" value={rec.drug_name} />
        <Field label="Dose" value={rec.dose} />
        <Field label="Patient age" value={rec.patient_age != null ? `${rec.patient_age} yrs` : undefined} />
        <Field
          label="Allergies (snapshot)"
          value={rec.patient_allergies_snapshot && rec.patient_allergies_snapshot.length ? rec.patient_allergies_snapshot.join(', ') : undefined}
        />
        <Field label="SLA threshold (min)" value={rec.sla_threshold_min ?? undefined} />
        <Field label="TAT at flag (min)" value={rec.tat_pharmacy_min_at_flag ?? undefined} />
        <Field label="Recommendation" value={rec.recommendation} />
        <Field label="IP address" value={rec.ip_address} mono />
        <Field label="Security type" value={rec.security_event_type} />
      </div>

      {(rec.resolved || rec.resolution_note || rec.resolution_type) && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">Resolution</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2">
            <Field label="Resolved" value={rec.resolved ? 'Yes' : 'No'} />
            <Field label="Resolved by" value={rec.resolved_by} />
            <Field label="Resolved at" value={fmt(rec.resolved_at)} />
            <Field label="Type" value={rec.resolution_type} />
          </div>
          <Field label="Note" value={rec.resolution_note} />
        </div>
      )}

      {(rec.countersigned || rec.countersign_note || rec.esig_required) && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">Countersign</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2">
            <Field label="E-sig required" value={rec.esig_required ? 'Yes' : 'No'} />
            <Field label="Countersigned" value={rec.countersigned ? 'Yes' : 'No'} />
            <Field label="By" value={rec.countersigned_by} />
            <Field label="At" value={fmt(rec.countersigned_at)} />
          </div>
          <Field label="Note" value={rec.countersign_note} />
        </div>
      )}

      <div className="mt-3 rounded-md border border-gray-200 bg-white px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">Hash chain</p>
        <Field label="Prev hash" value={rec.prev_hash} mono />
        <Field label="Record hash (stored)" value={rec.record_hash} mono />
        {!rec.verified && rec.recomputed_hash && (
          <Field label="Recomputed hash (mismatch)" value={rec.recomputed_hash} mono />
        )}
      </div>
    </div>
  );
}

export default function IntegrityCheckPage() {
  const navigate = useNavigate();
  const [rx, setRx] = useState('');
  const [loading, setLoading] = useState(false);
  const [rxResult, setRxResult] = useState<PrescriptionIntegrityResult | null>(null);
  const [allResult, setAllResult] = useState<IntegrityResult | null>(null);

  const checkRx = async () => {
    const id = rx.trim();
    if (!id) {
      toast.error('Enter a prescription number (e.g. RX-2026-0016)');
      return;
    }
    setLoading(true);
    setAllResult(null);
    try {
      const res = await auditsApi.verifyPrescriptionIntegrity(id);
      setRxResult(res.data);
      if (!res.data.found) {
        toast.error(`No prescription found for "${id}"`);
      } else {
        toast[res.data.intact ? 'success' : 'error'](
          res.data.intact ? 'Audit trail is intact' : 'Integrity problem detected'
        );
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to run integrity check'));
    } finally {
      setLoading(false);
    }
  };

  const checkAll = async () => {
    setLoading(true);
    setRxResult(null);
    try {
      const res = await auditsApi.verifyIntegrity();
      setAllResult(res.data);
      toast[res.data.intact ? 'success' : 'error'](
        res.data.intact ? 'Audit trail is intact' : 'Integrity problem detected'
      );
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to run integrity check'));
    } finally {
      setLoading(false);
    }
  };

  const found = rxResult?.found;
  const intact = rxResult?.intact ?? allResult?.intact;
  const showResult = (rxResult && found) || allResult;
  const issues = (rxResult && found ? rxResult.issues : allResult?.issues) ?? [];

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      <div className="print:hidden" style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div className="w-full px-6 py-4">
          <button
            onClick={() => navigate('/audits')}
            className="inline-flex items-center gap-1.5 text-xs mb-3 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Review Queue
          </button>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#1e3a5f]" />
                <h1 className="text-lg font-semibold text-gray-900">Audit Trail Integrity Check</h1>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Verify the tamper-evident hash chain for a single prescription or the entire audit trail.
              </p>
            </div>
            {rxResult && found && rxResult.trail && rxResult.trail.length > 0 && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" /> Print Report
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-6 space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5 print:hidden">
          <label className="block text-sm font-medium text-gray-700 mb-2">Prescription number or ID</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={rx}
              onChange={(e) => setRx(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') checkRx(); }}
              placeholder="RX-2026-0016"
              className="flex-1 min-w-[220px] px-3 py-2 rounded-md border border-gray-300 text-sm outline-none focus:border-green-500"
            />
            <button
              onClick={checkRx}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Run Check
            </button>
            <button
              onClick={checkAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              Check All Records
            </button>
          </div>
        </div>

        {rxResult && !found && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-amber-50 border-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              No prescription found for <span className="font-mono font-semibold">{rxResult.identifier}</span>.
            </p>
          </div>
        )}

        {showResult && (
          <div className={`rounded-lg border p-5 ${intact ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-3">
              {intact
                ? <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                : <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />}
              <div className="flex-1">
                <p className={`font-bold text-base ${intact ? 'text-green-800' : 'text-red-800'}`}>
                  {intact ? 'PASS: Audit trail is intact' : 'FAIL: Integrity problem detected'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {rxResult && found ? (
                    <>
                      {rxResult.rx_number ? <span className="font-mono">{rxResult.rx_number}</span> : 'This prescription'}
                      {rxResult.patient_name ? ` (${rxResult.patient_name})` : ''}
                      {', '}{rxResult.record_count} audit record{rxResult.record_count === 1 ? '' : 's'} checked
                      {rxResult.unchained_records ? `, ${rxResult.unchained_records} unchained` : ''}.
                    </>
                  ) : allResult ? (
                    <>
                      {allResult.total_chained_records} chained records checked
                      {allResult.unchained_records > 0 ? `, ${allResult.unchained_records} unchained` : ''}.
                      {!allResult.intact && allResult.first_break_at ? ` First break at record ${allResult.first_break_at}.` : ''}
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Checked {fmt((rxResult && found ? rxResult.checked_at : allResult?.checked_at))}.{' '}
                  {intact
                    ? 'Every record content hash matches its chain link, so nothing was edited or removed.'
                    : 'One or more records failed verification (see reasons below).'}
                </p>

                {!intact && issues.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {issues.map((iss, i) => (
                      <li key={i} className="text-xs text-red-700 bg-red-100/60 rounded px-2 py-1.5">
                        <span className="font-mono font-semibold">{iss.record_id}</span>
                        {': '}{iss.problem}
                        <span className="block text-red-600/80 mt-0.5">{iss.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {rxResult && found && rxResult.trail && rxResult.trail.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Full Audit Trail</h2>
              <p className="text-xs text-gray-500">
                Every audit record for this prescription, in chain order, with full detail and hash verification.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {rxResult.trail.map((rec, i) => (
                <TrailRecord key={rec.id} rec={rec} index={i} />
              ))}
            </div>
          </div>
        )}

        {rxResult && found && (!rxResult.trail || rxResult.trail.length === 0) && (
          <div className="px-4 py-3 rounded-lg border bg-gray-50 border-gray-200 text-sm text-gray-600">
            This prescription has no audit records.
          </div>
        )}
      </div>
    </div>
  );
}
