import React from 'react';

export const InsightsLanding: React.FC = () => {
  return (
    <div className="landing-stack">
      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title">Alignment insights</h2>
            <p className="panel__subtitle">
              Spot trends in upload quality, AI adoption, and downstream performance of grouped schedules.
            </p>
          </div>
          <div className="toolbar">
            <button type="button" className="btn btn-secondary">Configure dashboard</button>
            <button type="button" className="btn btn-primary">Schedule send</button>
          </div>
        </header>

        <div className="insights-grid">
          <article className="insight-card">
            <header>
              <h3>Upload-to-grouping conversion</h3>
              <span className="tag tag--success">+9%</span>
            </header>
            <p>The percentage of uploads that complete grouping within 48 hours is trending upward.</p>
            <div className="insight-card__chart">
              <div className="chart-bar" style={{ height: '45%' }} />
              <div className="chart-bar" style={{ height: '62%' }} />
              <div className="chart-bar" style={{ height: '78%' }} />
              <div className="chart-bar chart-bar--active" style={{ height: '84%' }} />
            </div>
            <footer>
              <span>Target: 80%</span>
              <button type="button" className="btn btn-ghost">View breakdown</button>
            </footer>
          </article>

          <article className="insight-card">
            <header>
              <h3>Manual overrides</h3>
              <span className="tag tag--danger">+12%</span>
            </header>
            <p>Teams are editing AI-proposed standardizations more frequently. Investigate high-variance headers.</p>
            <ul className="insight-card__list">
              <li>Mechanical services · 32 overrides</li>
              <li>Envelope assemblies · 27 overrides</li>
              <li>Electrical distribution · 19 overrides</li>
            </ul>
            <footer>
              <span>Goal: <strong>&lt; 10%</strong> manual touches</span>
              <button type="button" className="btn btn-secondary">Open deep dive</button>
            </footer>
          </article>

          <article className="insight-card">
            <header>
              <h3>Data quality scores</h3>
              <span className="tag tag--steady">Last 30 days</span>
            </header>
            <p>Quality gates evaluate column completeness, duplicate rates, and classification coverage.</p>
            <div className="insight-card__score">
              <span>91</span>
              <small>Composite score</small>
            </div>
            <div className="insight-card__badges">
              <span className="badge">Completeness 94%</span>
              <span className="badge">Duplicates 2%</span>
              <span className="badge">Coverage 88%</span>
            </div>
            <footer>
              <span>Next review: Monday</span>
              <button type="button" className="btn btn-ghost">Share with owners</button>
            </footer>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header-inline">
          <div>
            <h3 className="panel__title">Recommended follow-ups</h3>
            <p className="panel__subtitle">Target actions that have the biggest payoff for alignment performance.</p>
          </div>
          <button type="button" className="btn btn-ghost">View task board</button>
        </header>

        <ul className="todo-list">
          <li className="todo-list__item">
            <div>
              <h4>Coach the mechanical services team</h4>
              <p>Override rate exceeds 30%. Offer quick-start guides on naming conventions.</p>
            </div>
            <button type="button" className="btn btn-secondary">Assign owner</button>
          </li>
          <li className="todo-list__item">
            <div>
              <h4>Expand grouping templates</h4>
              <p>Create reusable groupings for healthcare projects to reduce setup time.</p>
            </div>
            <button type="button" className="btn btn-ghost">Add to roadmap</button>
          </li>
          <li className="todo-list__item">
            <div>
              <h4>Audit lifecycle cost libraries</h4>
              <p>Confirm custodianship and update depreciation assumptions for 2026.</p>
            </div>
            <button type="button" className="btn btn-ghost">Schedule review</button>
          </li>
        </ul>
      </section>
    </div>
  );
};

