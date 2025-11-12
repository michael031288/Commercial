import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeftIcon, ChevronRightIcon, RedoIcon, CheckCircleIcon, XIcon as XCircleIcon } from './Icons';

type Decision = 'accepted' | 'rejected' | 'pending';

interface StandardisationReviewProps {
  changes: Record<string, string>;
  onComplete: (approvedChanges: Record<string, string>) => void;
  onBack: () => void;
  onReset: () => void;
  onSkip?: () => void;
}

export const StandardisationReview: React.FC<StandardisationReviewProps> = ({ changes, onComplete, onBack, onReset, onSkip }) => {
  const allProposals = useMemo(() => {
    return Object.entries(changes).map(([from, to]) => ({ from, to }));
  }, [changes]);

  const [editableChanges, setEditableChanges] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [editingHeader, setEditingHeader] = useState<string | null>(null);

  useEffect(() => {
    const initialEditable = allProposals.reduce((acc, { from, to }) => {
      acc[from] = to;
      return acc;
    }, {} as Record<string, string>);
    setEditableChanges(initialEditable);

    const initialDecisions = allProposals.reduce((acc, { from }) => {
      acc[from] = 'pending';
      return acc;
    }, {} as Record<string, Decision>);
    setDecisions(initialDecisions);
  }, [allProposals]);

  const handleHeaderChange = (from: string, newTo: string) => {
    setEditableChanges(prev => ({ ...prev, [from]: newTo }));
  };

  const handleDecision = (from: string, decision: Decision) => {
    setDecisions(prev => ({ ...prev, [from]: decision }));
  };

  const handleAcceptAll = () => {
    const newDecisions: Record<string, Decision> = {};
    allProposals.forEach(change => {
      newDecisions[change.from] = 'accepted';
    });
    setDecisions(newDecisions);
  };

  const handleRejectAll = () => {
    const newDecisions: Record<string, Decision> = {};
    allProposals.forEach(change => {
      newDecisions[change.from] = 'rejected';
    });
    setDecisions(newDecisions);
  };

  const handleNext = () => {
    const finalMapping: Record<string, string> = {};

    for (const originalHeader in changes) {
        const decision = decisions[originalHeader];
        
        if (decision === 'accepted') {
            finalMapping[originalHeader] = editableChanges[originalHeader];
        } else if (decision === 'rejected') {
            finalMapping[originalHeader] = originalHeader;
        } else {
            finalMapping[originalHeader] = changes[originalHeader];
        }
    }
    
    onComplete(finalMapping);
  };
  
  const pendingCount = useMemo(() => Object.values(decisions).filter(d => d === 'pending').length, [decisions]);

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2 className="panel__title">Step 2 · Review standardisation</h2>
          <p className="panel__subtitle">
            Double-check each header the AI proposed. Click a proposed label to edit the wording, then accept or reject the update.
          </p>
        </div>
        <button type="button" onClick={onReset} className="btn btn-ghost">
          <RedoIcon width={16} height={16} /> Start over
        </button>
      </div>

      {allProposals.length > 0 ? (
        <>
          <div className="toolbar">
            <button type="button" className="btn btn-secondary" onClick={handleAcceptAll}>Accept all</button>
            <button type="button" className="btn btn-secondary" onClick={handleRejectAll}>Reject all</button>
            {pendingCount > 0 && (
              <span className="tag tag--warning">{pendingCount} pending decisions</span>
            )}
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Original header</th>
                  <th scope="col">Proposed header</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {allProposals.map(({ from }) => {
                  const isUnchanged = changes[from] === from;
                  const rowState = decisions[from];
                  return (
                    <tr key={from} style={rowState === 'pending' && isUnchanged ? { opacity: 0.65 } : undefined}>
                      <td style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 13 }}>{from}</td>
                      <td
                        style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 13, cursor: 'pointer' }}
                        onClick={() => setEditingHeader(from)}
                      >
                        {editingHeader === from ? (
                          <input
                            type="text"
                            className="editable-input"
                            value={editableChanges[from]}
                            autoFocus
                            onChange={(e) => handleHeaderChange(from, e.target.value)}
                            onBlur={() => setEditingHeader(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setEditingHeader(null);
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        ) : (
                          editableChanges[from] || ''
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={rowState === 'accepted' ? { color: 'var(--success)', background: 'rgba(22, 163, 74, 0.12)' } : undefined}
                            onClick={() => handleDecision(from, 'accepted')}
                            title="Accept"
                          >
                            <CheckCircleIcon width={18} height={18} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={rowState === 'rejected' ? { color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.12)' } : undefined}
                            onClick={() => handleDecision(from, 'rejected')}
                            title="Reject"
                          >
                            <XCircleIcon width={18} height={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <CheckCircleIcon />
          <h3 className="panel__title" style={{ marginTop: 6 }}>No headers to standardise</h3>
          <p className="muted">Your uploaded data already follows our naming guidelines. Continue to grouping.</p>
        </div>
      )}

      <div className="table-companion">
        <span>Approved headers override the originals. Rejected items keep their current label.</span>
      </div>

      <div className="sticky-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeftIcon width={16} height={16} /> Back
        </button>
        {onSkip && (
          <button type="button" className="btn btn-secondary" onClick={onSkip}>
            Skip standardisation
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleNext}
          disabled={pendingCount > 0}
          title={pendingCount > 0 ? 'Please review all suggestions before proceeding' : 'Continue to the next step'}
        >
          Next step <ChevronRightIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
};

