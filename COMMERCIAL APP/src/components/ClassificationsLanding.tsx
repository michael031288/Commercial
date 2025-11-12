import React, { useState, useEffect, useRef } from 'react';
import { NRMGroup } from '../services/geminiService';
import { FileIcon, RedoIcon, EnterFullScreenIcon, ExitFullScreenIcon, DashboardIcon, ListIcon } from './Icons';
import { DashboardView } from './DashboardView';
import { CategoryListView, CategoryDetailView } from './ResultsDisplay';

interface ClassificationsLandingProps {
  groupedData: NRMGroup[] | null;
  fileName: string;
  onReset: () => void;
}

export const ClassificationsLanding: React.FC<ClassificationsLandingProps> = ({ groupedData, fileName, onReset }) => {
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
              <h2 className="panel__title">NRM Classifications</h2>
              <p className="panel__subtitle">
                Review your grouped elements organized by NRM work sections.
              </p>
              <div className="value-chip" style={{ marginTop: 8 }}>
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

  // Default classifications content when no grouped data
  return (
    <div className="landing-stack">
      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title">Classification frameworks</h2>
            <p className="panel__subtitle">
              Configure and monitor the taxonomies your teams rely on for cost planning and asset reporting.
            </p>
          </div>
        </header>

        <div className="card-grid">
          <article className="card">
            <div className="card__header">
              <div>
                <h3>NRM</h3>
                <p>RICS New Rules of Measurement</p>
              </div>
              <span className="tag tag--success">Active</span>
            </div>
            <ul className="card__list">
              <li>Version 3.1 · 612 elements</li>
              <li>Aligned projects: 8</li>
              <li>Overrides detected: 14 headers</li>
            </ul>
          </article>

          <article className="card">
            <div className="card__header">
              <div>
                <h3>Uniclass</h3>
                <p>Unified classification for the UK construction industry</p>
              </div>
              <span className="tag">Draft</span>
            </div>
            <ul className="card__list">
              <li>Version 2024-Q3 · 842 elements</li>
              <li>Aligned projects: 2 pilots</li>
              <li>Mapping coverage: 64%</li>
            </ul>
          </article>

          <article className="card card--muted">
            <div className="card__header">
              <div>
                <h3>Custom framework</h3>
                <p>Design your own grouping strategy for regional requirements.</p>
              </div>
            </div>
            <div className="card__empty">
              <p>No custom frameworks yet. Start with our guided builder to define stages, components, and attributes.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header-inline">
          <div>
            <h3 className="panel__title">Governance queue</h3>
            <p className="panel__subtitle">Review proposed changes before they reach production datasets.</p>
          </div>
        </header>

        <div className="table-wrapper">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Change</th>
                <th>Submitted by</th>
                <th>Impact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Add new sub-element for prefabricated risers</td>
                <td>Emily Watson · UK Region</td>
                <td><span className="tag tag--warning">Moderate</span></td>
                <td>Awaiting review</td>
              </tr>
              <tr>
                <td>Rename HVAC control headers for automation</td>
                <td>Rahul Patel · Automation Guild</td>
                <td><span className="tag tag--success">Low</span></td>
                <td>Approved</td>
              </tr>
              <tr>
                <td>Retire legacy cost code 21.05</td>
                <td>Martin Diaz · Finance Ops</td>
                <td><span className="tag tag--danger">High</span></td>
                <td>Scheduled</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

