import React, { useState, useEffect, useRef } from 'react';
import { NRMGroup, NRMElementData } from '../services/geminiService';
import { FileIcon, RedoIcon, EnterFullScreenIcon, ExitFullScreenIcon, DashboardIcon, ListIcon, ArrowLeftIcon, PlusIcon, PackageIcon, UploadIcon, XIcon } from './Icons';
import { DashboardView } from './DashboardView';
import { CategoryListView, CategoryDetailView } from './ResultsDisplay';
import { PackData, ScheduleViewData } from '../services/firestoreService';

interface OverviewLandingProps {
  groupedData: NRMGroup[] | null;
  fileName: string;
  onReset: () => void;
  onBack?: () => void;
  userId?: string;
  projectId?: string;
  scheduleId?: string;
  packs?: PackData[];
  onSaveView?: (viewName: string, packId: string | null) => void;
  onExportCSV?: (data: NRMElementData[]) => void;
}

export const OverviewLanding: React.FC<OverviewLandingProps> = ({ groupedData, fileName, onReset, onBack, userId, projectId, scheduleId, packs, onSaveView, onExportCSV }) => {
  const [selectedSection, setSelectedSection] = useState<NRMGroup | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'browse'>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const detailViewRef = useRef<HTMLDivElement>(null);
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

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

  const handleExportCSV = () => {
    if (!groupedData || groupedData.length === 0) return;
    
    // Convert grouped data to flat array
    const flatData: NRMElementData[] = [];
    groupedData.forEach(group => {
      if (group.elements) {
        group.elements.forEach(element => {
          flatData.push(element.originalRowData);
        });
      }
    });
    
    if (onExportCSV) {
      onExportCSV(flatData);
    } else {
      // Fallback export
      const rows: string[][] = [];
      if (flatData.length > 0) {
        const headers = Object.keys(flatData[0]);
        rows.push(headers);
        flatData.forEach(element => {
          rows.push(headers.map(header => String(element[header] || '')));
        });
      }
      
      const csvContent = rows.map(row => 
        row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName.replace(/\.csv$/i, '')}_grouped_export.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
              {onBack && (
                <button type="button" className="btn btn-secondary" onClick={onBack}>
                  <ArrowLeftIcon width={16} height={16} /> Back
                </button>
              )}
              {onSaveView && scheduleId && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowSaveViewModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <PlusIcon width={16} height={16} />
                  Save View
                </button>
              )}
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleExportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <UploadIcon width={16} height={16} />
                Export CSV
              </button>
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
        
        {/* Save View Modal */}
        {showSaveViewModal && onSaveView && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }} onClick={() => setShowSaveViewModal(false)}>
            <div 
              className="card" 
              style={{ 
                width: '90%', 
                maxWidth: '500px',
                padding: '24px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Save Current View</h3>
                <button 
                  type="button"
                  onClick={() => setShowSaveViewModal(false)}
                  className="btn btn-ghost"
                  style={{ padding: '4px' }}
                >
                  <XIcon width={16} height={16} />
                </button>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  View Name
                </label>
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="e.g., Main View, Filtered View"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newViewName.trim()) {
                      onSaveView(newViewName, selectedPackId);
                      setShowSaveViewModal(false);
                      setNewViewName('');
                      setSelectedPackId(null);
                    } else if (e.key === 'Escape') {
                      setShowSaveViewModal(false);
                    }
                  }}
                />
              </div>
              {packs && packs.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                    Add to Package (optional)
                  </label>
                  <select
                    value={selectedPackId || ''}
                    onChange={(e) => setSelectedPackId(e.target.value || null)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">No package</option>
                    {packs.map(pack => (
                      <option key={pack.id} value={pack.id}>{pack.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSaveViewModal(false);
                    setNewViewName('');
                    setSelectedPackId(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (newViewName.trim()) {
                      onSaveView(newViewName, selectedPackId);
                      setShowSaveViewModal(false);
                      setNewViewName('');
                      setSelectedPackId(null);
                    }
                  }}
                  disabled={!newViewName.trim()}
                >
                  Save View
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default overview content when no grouped data - show empty state
  return (
    <div className="landing-stack">
      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title">Project Overview</h2>
            <p className="panel__subtitle">
              No data available yet. Upload schedules, drawings, or IFC models to get started.
            </p>
          </div>
        </header>
      </section>
    </div>
  );
};
