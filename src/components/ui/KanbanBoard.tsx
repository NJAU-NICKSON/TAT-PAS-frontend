import { FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TATTimer } from './TATTimer';

export interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  prescriptions: any[];
  avgWaitTime: number;
  waitTimeBucket?: '<10' | 'â‰¥10';
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  onCardAction: (action: string, rxId: string) => void;
  currentUserRole: string;
}

export function KanbanBoard({ columns, onCardAction, currentUserRole }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
      {columns.map((column) => (
        <div key={column.id} className="space-y-4 flex flex-col h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-h3 font-semibold text-text-primary">{column.title}</h3>
            <div className="flex items-center gap-4 text-body-sm text-text-muted">
              <span>{column.prescriptions.length}</span>
              <span>{column.avgWaitTime}min avg</span>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {column.prescriptions.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center py-8">
                <FileText className="h-8 w-8 text-text-muted mb-2" />
                <p className="text-body-sm text-text-muted">No prescriptions in this stage</p>
              </div>
            ) : (
              column.prescriptions.map((prescription) => {
                const waitTime = prescription.waitTimeMinutes || 0;
                const timerColor = waitTime < 10 ? 'bg-green-600' : waitTime < 20 ? 'bg-yellow-600' : 'bg-red-600';
                return (
                  <div
                    key={prescription.id}
                    className="p-4 bg-surface-0 rounded-lg border border-surface-3 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono text-caption text-text-secondary mb-1">
                          {prescription.id.slice(0, 8)}...
                        </p>
                        <p className="font-semibold text-text-primary">{prescription.patient_name}</p>
                      </div>
                      <TATTimer
                        startTime={prescription.ordered_at}
                        slaThresholdMin={prescription.slaThresholdMin || 15}
                        size="sm"
                      />
                    </div>
                    <p className="text-body-sm text-text-muted mb-2">
                      {prescription.medications?.[0]?.name || 'Unknown drug'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onCardAction('view', prescription.id)}
                        className="text-body-sm text-clinical-700 hover:text-clinical-800"
                      >
                        View
                      </button>
                      {prescription.status === 'submitted' && currentUserRole === 'pharmacist' && (
                        <button
                          onClick={() => onCardAction('verify', prescription.id)}
                          className="text-body-sm text-green-700 hover:text-green-800"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
