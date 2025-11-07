import React from 'react';
import { StepIndicator } from './StepIndicator';
import { ActivePage } from '../types/navigation';

interface HeaderProps {
  activePage: ActivePage;
  currentStep: number;
  onReset: () => void;
}

const pageCopy: Record<ActivePage, { title: string; subtitle: string; badges: string[] }> = {
  overview: {
    title: 'BIM Schedule Workspace',
    subtitle: 'Executive overview of adoption, quality, and rollout status.',
    badges: ['Executive summary', 'Auto-save enabled'],
  },
  uploads: {
    title: 'BIM Schedule Workspace',
    subtitle: 'Align your BIM schedules with the RICS NRM library, step by step.',
    badges: [''], // placeholder, handled dynamically
  },
  classifications: {
    title: 'Classification governance',
    subtitle: 'Manage taxonomies, approvals, and change requests for your standards.',
    badges: ['Governance mode', 'Version control active'],
  },
  library: {
    title: 'NRM Library',
    subtitle: 'Explore canonical content and share guidance with delivery teams.',
    badges: ['Official library', 'Stewarded content'],
  },
  insights: {
    title: 'Alignment insights',
    subtitle: 'Track performance metrics and take action on emerging trends.',
    badges: ['Analytics preview', 'Last refresh · 5 min ago'],
  },
};

export const Header: React.FC<HeaderProps> = ({ activePage, currentStep, onReset }) => {
  const copy = pageCopy[activePage];
  const badges = activePage === 'uploads'
    ? [
        `Current step · ${
          currentStep === 0
            ? 'Upload'
            : currentStep === 1
            ? 'Review extraction'
            : currentStep === 2
            ? 'Approve standardization'
            : currentStep === 3
            ? 'Finalize dataset'
            : 'Explore groupings'
        }`,
        'Auto-save enabled',
      ]
    : copy.badges;

  return (
    <header className="shell-header">
      <div>
        <div className="hero">
          <h1 className="shell-header__title" onClick={onReset} role="button" tabIndex={0}>
            {copy.title}
          </h1>
          <p className="shell-header__subtitle">{copy.subtitle}</p>
          <div className="hero__meta">
            {badges.map((badge) => (
              <span key={badge} className="badge">
                {badge}
              </span>
            ))}
          </div>
        </div>
        {activePage === 'uploads' && currentStep > 0 && currentStep < 5 && (
          <StepIndicator currentStep={currentStep} />
        )}
      </div>
      <div className="shell-header__meta">
        <div className="header-toolbar">
          <input
            type="search"
            className="search-field header-toolbar__search"
            placeholder={activePage === 'insights' ? 'Search metrics or dashboards' : 'Find columns or codes'}
            aria-label="Find columns or codes"
          />
          <button type="button" className="btn btn-secondary">Filters</button>
          <button type="button" className="btn btn-primary">
            {activePage === 'uploads' ? 'Add dataset' : 'Create entry'}
          </button>
        </div>
        <div className="avatar-pill" aria-label="Account">
          <span className="avatar-pill__photo">AN</span>
          <div className="avatar-pill__name">
            Andrew Nolan
            <span>Workspace Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
};