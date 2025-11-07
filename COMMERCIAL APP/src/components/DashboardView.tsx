import React from 'react';
import { NRMGroup } from '../services/geminiService';
import { BuildingIcon, ListIcon, StarIcon, ChevronRightIcon } from './Icons';

interface DashboardViewProps {
  groups: NRMGroup[];
  onSelectSection: (section: NRMGroup) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ groups, onSelectSection }) => {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <p>No grouped data yet. Upload a schedule and run the pipeline to populate insights.</p>
      </div>
    );
  }

  const totalElements = groups.reduce((acc, group) => acc + group.elements.length, 0);
  const totalSections = groups.length;
  const topSection = groups.reduce(
    (top, current) => (current.elements.length > top.elements.length ? current : top),
    groups[0]
  );

  const sortedGroups = [...groups].sort((a, b) => b.elements.length - a.elements.length);
  const maxElements = sortedGroups[0]?.elements.length || 1;

  const SummaryCard: React.FC<{ icon: React.ReactNode; title: string; value: string; subtitle?: string }> = ({ icon, title, value, subtitle }) => (
    <div className="metric-card" role="presentation">
      <div className="metric-card__icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 14, background: 'rgba(37,99,235,0.12)', color: 'var(--accent-primary)' }}>
        {icon}
      </div>
      <div style={{ marginTop: 14 }}>
        <p className="metric-card__label">{title}</p>
        <div className="metric-card__value">{value}</div>
        {subtitle && <p className="muted" style={{ marginTop: 6 }}>{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid grid--two" style={{ marginBottom: 28 }}>
        <SummaryCard 
          icon={<BuildingIcon width={20} height={20} />} 
          title="Total Elements" 
          value={totalElements.toLocaleString()} 
        />
        <SummaryCard 
          icon={<ListIcon width={20} height={20} />} 
          title="NRM Sections" 
          value={totalSections.toLocaleString()} 
        />
        <SummaryCard 
          icon={<StarIcon width={20} height={20} />} 
          title="Top Section" 
          value={`${topSection.elements.length.toLocaleString()} items`} 
          subtitle={topSection.nrmSection}
        />
      </div>

      <div>
        <h3 className="panel__title" style={{ fontSize: 18, marginBottom: 16 }}>Element distribution by NRM section</h3>
        <div className="panel" style={{ padding: 20 }}>
          {sortedGroups.map(group => {
            const barWidth = (group.elements.length / maxElements) * 100;
            return (
              <button
                type="button"
                key={group.nrmSection}
                onClick={() => onSelectSection(group)}
                className="result-item"
                title={`Inspect ${group.nrmSection}`}
              >
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="muted" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{group.nrmSection}</span>
                    <span style={{ fontWeight: 600 }}>{group.elements.length.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-app)', overflow: 'hidden' }}>
                    <div style={{ width: `${barWidth}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(135deg, var(--accent-primary), #38bdf8)' }} />
                  </div>
                </div>
                <ChevronRightIcon width={16} height={16} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
