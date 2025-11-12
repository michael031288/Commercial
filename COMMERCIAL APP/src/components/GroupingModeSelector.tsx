import React from 'react';
import { WandIcon, HandIcon } from './Icons';

interface GroupingModeSelectorProps {
  onSelectMode: (mode: 'manual' | 'ai') => void;
}

export const GroupingModeSelector: React.FC<GroupingModeSelectorProps> = ({ onSelectMode }) => {
  return (
    <div>
      <div className="page-heading">
        <div>
          <h2 className="panel__title">Choose Grouping Method</h2>
          <p className="panel__subtitle">
            Select how you want to group your data into NRM work sections. You can start with manual grouping and then use AI for remaining items.
          </p>
        </div>
      </div>

      <div className="grouping-mode-grid">
        <button
          type="button"
          className="grouping-mode-card"
          onClick={() => onSelectMode('manual')}
        >
          <div className="grouping-mode-card__icon">
            <HandIcon width={32} height={32} />
          </div>
          <h3 className="grouping-mode-card__title">Manual Grouping</h3>
          <p className="grouping-mode-card__description">
            Manually assign rows to NRM packages. Review and organize your data with full control. You can run AI grouping on remaining items afterward.
          </p>
          <div className="grouping-mode-card__features">
            <span className="tag">Full control</span>
            <span className="tag">Package manager</span>
            <span className="tag">Can combine with AI</span>
          </div>
        </button>

        <button
          type="button"
          className="grouping-mode-card"
          onClick={() => onSelectMode('ai')}
        >
          <div className="grouping-mode-card__icon">
            <WandIcon width={32} height={32} />
          </div>
          <h3 className="grouping-mode-card__title">AI Grouping</h3>
          <p className="grouping-mode-card__description">
            Let AI automatically categorize your elements into NRM work sections. Fast and efficient for large datasets.
          </p>
          <div className="grouping-mode-card__features">
            <span className="tag">Automatic</span>
            <span className="tag">Fast processing</span>
            <span className="tag">AI-powered</span>
          </div>
        </button>
      </div>
    </div>
  );
};

