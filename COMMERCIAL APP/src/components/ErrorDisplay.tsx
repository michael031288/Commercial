import React from 'react';
import { AlertTriangleIcon, RedoIcon } from './Icons';

interface ErrorDisplayProps {
    error: string | null;
    onReset: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onReset }) => {
    if (!error) return null;

    return (
        <div className="alert-card" role="alert">
            <div className="alert-card__title">
                <AlertTriangleIcon width={20} height={20} />
                Processing failed
            </div>
            <p className="muted danger-text">{error}</p>
            <div className="alert-card__actions">
                <button type="button" className="btn btn-secondary" onClick={onReset}>
                    <RedoIcon width={16} height={16} /> Try again
                </button>
            </div>
        </div>
    );
};