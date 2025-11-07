import React from 'react';
import { CheckCircleIcon, CircleIcon } from './Icons';

export interface ProgressStep {
  title: string;
  status: 'pending' | 'active' | 'complete';
}

interface ProgressDisplayProps {
  steps: ProgressStep[];
  progress: number;
}

const getStepIcon = (status: ProgressStep['status']) => {
  switch (status) {
    case 'complete':
      return <CheckCircleIcon width={20} height={20} style={{ color: 'var(--accent-primary)' }} />;
    case 'active':
      return <div style={{ width: 20, height: 20, border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;
    case 'pending':
      return <CircleIcon width={20} height={20} style={{ color: 'var(--text-tertiary)' }} />;
  }
};

const getStepTextStyles = (status: ProgressStep['status']): React.CSSProperties => {
  switch (status) {
    case 'complete':
      return { color: 'var(--text-secondary)', fontWeight: 600 };
    case 'active':
      return { color: 'var(--accent-primary)', fontWeight: 600 };
    case 'pending':
    default:
      return { color: 'var(--text-tertiary)' };
  }
};

export const ProgressDisplay: React.FC<ProgressDisplayProps> = ({ steps, progress }) => {
  const activeStep = steps.find(s => s.status === 'active');

  return (
    <div className="loading-screen">
      <div className="loading-card">
        <h2 className="panel__title" style={{ textAlign: 'center' }}>Processing your file</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 24 }}>
          {activeStep ? activeStep.title : 'Please wait...'}
        </p>

        <div className="progress-track">
          <div className="progress-track__bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 12, fontWeight: 600 }}>{Math.round(progress)}% complete</p>

        <div className="status-card" style={{ marginTop: 24 }}>
          {steps.map((step, index) => {
            const textStyle = getStepTextStyles(step.status);
            return (
              <div key={index} className="progress-step">
                {getStepIcon(step.status)}
                <span style={{ fontSize: 14, ...textStyle }}>{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};