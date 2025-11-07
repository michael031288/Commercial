import React from 'react';

export const ClassificationsLanding: React.FC = () => {
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
          <div className="toolbar">
            <button type="button" className="btn btn-secondary">Import schema</button>
            <button type="button" className="btn btn-primary">Create framework</button>
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
            <div className="card__actions">
              <button type="button" className="btn btn-ghost">View hierarchy</button>
              <button type="button" className="btn btn-secondary">Manage mappings</button>
            </div>
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
            <div className="card__actions">
              <button type="button" className="btn btn-ghost">Preview</button>
              <button type="button" className="btn btn-secondary">Request review</button>
            </div>
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
              <button type="button" className="btn btn-primary">Launch builder</button>
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
          <button type="button" className="btn btn-ghost">Open governance hub</button>
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

