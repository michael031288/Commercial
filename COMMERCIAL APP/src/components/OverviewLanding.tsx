import React from 'react';

export const OverviewLanding: React.FC = () => {
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
          <div className="toolbar">
            <button type="button" className="btn btn-secondary">Download summary</button>
            <button type="button" className="btn btn-primary">Share report</button>
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
          <button type="button" className="btn btn-ghost">View all runs</button>
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
            <button type="button" className="btn btn-ghost">Open</button>
          </article>
          <article className="timeline-card">
            <div className="timeline-card__marker timeline-card__marker--queued" />
            <div>
              <h4 className="timeline-card__title">Airport Expansion Lot B</h4>
              <p className="timeline-card__meta">Awaiting upload · Owner: Sarah Lee</p>
            </div>
            <button type="button" className="btn btn-secondary">Invite team</button>
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
            <button type="button" className="btn btn-ghost">View memo</button>
          </li>
          <li className="resource-list__item">
            <div>
              <h4>Classification onboarding playbook</h4>
              <p>Step-by-step guidance for regional offices adopting the AI-assisted upload flow.</p>
            </div>
            <button type="button" className="btn btn-ghost">Download</button>
          </li>
          <li className="resource-list__item">
            <div>
              <h4>Upcoming training sessions</h4>
              <p>Two live enablement sessions scheduled next week covering advanced grouping strategies.</p>
            </div>
            <button type="button" className="btn btn-ghost">Reserve seat</button>
          </li>
        </ul>
      </section>
    </div>
  );
};

