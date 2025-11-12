import React, { useState, useEffect, useRef } from 'react';
import { NRMGroup } from '../services/geminiService';
import { FileIcon, RedoIcon, EnterFullScreenIcon, ExitFullScreenIcon, DashboardIcon, ListIcon } from './Icons';
import { DashboardView } from './DashboardView';
import { CategoryListView, CategoryDetailView } from './ResultsDisplay';

interface OverviewLandingProps {
  groupedData: NRMGroup[] | null;
  fileName: string;
  onReset: () => void;
}

export const OverviewLanding: React.FC<OverviewLandingProps> = ({ groupedData, fileName, onReset }) => {
  const [selectedSection, setSelectedSection] = useState<NRMGroup | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'browse'>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const detailViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullscreen(document.fullscreenElement === detailViewRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      detailViewRef.current?.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleSelectSection = (section: NRMGroup) => {
    setSelectedSection(section);
  };

  const TabButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, icon, isActive, onClick }) => {
    return (
      <button type="button" onClick={onClick} className={`pill-tab ${isActive ? 'pill-tab--active' : ''}`}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {icon}
          {label}
        </span>
      </button>
    );
  };

  // If grouped data exists, show the grouped results view
  if (groupedData && groupedData.length > 0) {
    return (
      <div className="landing-stack">
        <section className="panel">
          <header className="page-heading">
            <div>
              <h2 className="panel__title">Grouped Results</h2>
              <div className="value-chip">
                <FileIcon width={16} height={16} />
                {fileName || 'Untitled schedule.csv'}
              </div>
            </div>
            <div className="toolbar">
              {selectedSection && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={toggleFullScreen}
                  title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                >
                  {isFullscreen ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <ExitFullScreenIcon width={16} height={16} /> Exit full screen
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <EnterFullScreenIcon width={16} height={16} /> Full screen view
                    </span>
                  )}
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={onReset}>
                <RedoIcon width={16} height={16} /> Start over
              </button>
            </div>
          </header>

          {!selectedSection ? (
            <div>
              <div className="pill-tabs" role="tablist">
                <TabButton
                  label="Dashboard"
                  icon={<DashboardIcon width={16} height={16} />}
                  isActive={activeView === 'dashboard'}
                  onClick={() => setActiveView('dashboard')}
                />
                <TabButton
                  label="Browse sections"
                  icon={<ListIcon width={16} height={16} />}
                  isActive={activeView === 'browse'}
                  onClick={() => setActiveView('browse')}
                />
              </div>
              {activeView === 'dashboard' ? (
                <DashboardView groups={groupedData} onSelectSection={handleSelectSection} />
              ) : (
                <CategoryListView groups={groupedData} onSelectSection={handleSelectSection} />
              )}
            </div>
          ) : (
            <CategoryDetailView
              ref={detailViewRef}
              section={selectedSection}
              onBack={() => setSelectedSection(null)}
              isFullscreen={isFullscreen}
            />
          )}
        </section>
      </div>
    );
  }

  // Default overview content when no grouped data
  return (
    <div className="landing-stack">
      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title">Workspace Snapshot</h2>
            <p className="panel__subtitle">
              Monitor the health of your BIM schedules, open tasks, and NRM adoption across projects.
            </p>
          </div>
        </header>

        <div className="metric-grid">
          <article className="metric-card">
            <span className="metric-card__label">Active datasets</span>
            <span className="metric-card__value">12</span>
            <span className="metric-card__trend metric-card__trend--up">+3 this week</span>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">NRM alignment</span>
            <span className="metric-card__value">86%</span>
            <span className="metric-card__trend metric-card__trend--steady">Stable</span>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">AI assisted columns</span>
            <span className="metric-card__value">1,420</span>
            <span className="metric-card__trend metric-card__trend--up">+14%</span>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Flagged anomalies</span>
            <span className="metric-card__value">5</span>
            <span className="metric-card__trend metric-card__trend--down">-2 since yesterday</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header-inline">
          <div>
            <h3 className="panel__title">Workflow spotlight</h3>
            <p className="panel__subtitle">
              See where teams are in the upload-to-grouping journey and jump in to assist.
            </p>
          </div>
        </header>

        <div className="timeline-list">
          <article className="timeline-card">
            <div className="timeline-card__marker timeline-card__marker--success" />
            <div>
              <h4 className="timeline-card__title">Hospital West Project</h4>
              <p className="timeline-card__meta">Completed grouping · 8 hours ago</p>
            </div>
            <span className="tag tag--success">Ready for export</span>
          </article>
          <article className="timeline-card">
            <div className="timeline-card__marker timeline-card__marker--progress" />
            <div>
              <h4 className="timeline-card__title">March 2025 Schedule</h4>
              <p className="timeline-card__meta">Standardization review in progress</p>
            </div>
          </article>
          <article className="timeline-card">
            <div className="timeline-card__marker timeline-card__marker--queued" />
            <div>
              <h4 className="timeline-card__title">Airport Expansion Lot B</h4>
              <p className="timeline-card__meta">Awaiting upload · Owner: Sarah Lee</p>
            </div>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header-inline">
          <div>
            <h3 className="panel__title">Recent announcements</h3>
            <p className="panel__subtitle">
              Keep everyone aligned on library updates, classification changes, and rollout plans.
            </p>
          </div>
        </header>

        <ul className="resource-list">
          <li className="resource-list__item">
            <div>
              <h4>NRM v3.2 release window confirmed</h4>
              <p>New mechanical services structure ships January 2026. Review the crosswalk plan with your teams.</p>
            </div>
          </li>
          <li className="resource-list__item">
            <div>
              <h4>Classification onboarding playbook</h4>
              <p>Step-by-step guidance for regional offices adopting the AI-assisted upload flow.</p>
            </div>
          </li>
          <li className="resource-list__item">
            <div>
              <h4>Upcoming training sessions</h4>
              <p>Two live enablement sessions scheduled next week covering advanced grouping strategies.</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
};
