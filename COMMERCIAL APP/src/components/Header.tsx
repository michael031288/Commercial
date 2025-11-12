import React from 'react';
import { StepIndicator } from './StepIndicator';
import { ActivePage } from '../types/navigation';
import { MenuIcon, XIcon } from './Icons';
import { User } from 'firebase/auth';
import { Project } from '../types/project';

interface HeaderProps {
  activePage: ActivePage;
  currentStep: number;
  onReset: () => void;
  onMobileMenuToggle: () => void;
  isMobileMenuOpen: boolean;
  user: User | null;
  onSignOut: () => void;
  selectedProject: Project | null;
}

const pageCopy: Record<ActivePage, { title: string; subtitle: string; badges: string[] }> = {
  projects: {
    title: 'Projects',
    subtitle: 'Select an existing project or create a new one to get started.',
    badges: [],
  },
  overview: {
    title: 'DC - ESTIMATE Workspace',
    subtitle: '',
    badges: [],
  },
  uploads: {
    title: 'DC - ESTIMATE Workspace',
    subtitle: 'Align your schedules with the RICS NRM library, step by step.',
    badges: [''], // placeholder, handled dynamically
  },
  schedules: {
    title: 'Schedule Management',
    subtitle: 'Manage and view your uploaded CSV schedules',
    badges: [],
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
  drawings: {
    title: 'Drawing Markup',
    subtitle: 'Upload PDF drawings, set scales, and mark up with measurements, areas, and counts.',
    badges: ['Markup tools', 'Auto-save enabled'],
  },
};

export const Header: React.FC<HeaderProps> = ({ activePage, currentStep, onReset, onMobileMenuToggle, isMobileMenuOpen, user, onSignOut, selectedProject }) => {
  const copy = pageCopy[activePage];
  
  // Safety check - if copy is undefined, use defaults
  if (!copy) {
    console.error(`No page copy found for activePage: ${activePage}`);
  }
  
  // Use project name for overview page title
  const title = activePage === 'overview' && selectedProject 
    ? selectedProject.name 
    : (copy?.title || 'Projects');
  
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
    : (copy?.badges || []);

  const getUserInitials = (user: User | null): string => {
    if (!user) return 'U';
    if (user.displayName) {
      const names = user.displayName.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.displayName.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getUserName = (user: User | null): string => {
    if (!user) return 'User';
    return user.displayName || user.email?.split('@')[0] || 'User';
  };

  return (
    <header className="shell-header" style={{ minHeight: '60px', padding: '16px 24px' }}>
      <div className="shell-header__left">
        <button 
          className="mobile-menu-toggle"
          onClick={onMobileMenuToggle}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <XIcon /> : <MenuIcon />}
        </button>
        {activePage === 'uploads' && currentStep > 0 && currentStep < 5 && (
          <StepIndicator currentStep={currentStep} />
        )}
      </div>
      <div className="shell-header__meta">
        {activePage !== 'projects' && (
          <div className="header-toolbar">
            <input
              type="search"
              className="search-field header-toolbar__search"
              placeholder={activePage === 'insights' ? 'Search metrics or dashboards' : 'Find columns or codes'}
              aria-label="Find columns or codes"
            />
          </div>
        )}
        <div className="avatar-pill" aria-label="Account" style={{ position: 'relative' }}>
          <span className="avatar-pill__photo">{getUserInitials(user)}</span>
          <div className="avatar-pill__name">
            {getUserName(user)}
            <span>{user?.email || 'User'}</span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            style={{
              marginLeft: '8px',
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};