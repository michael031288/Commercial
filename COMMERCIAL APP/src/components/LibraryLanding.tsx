import React from 'react';

export const LibraryLanding: React.FC = () => {
  return (
    <div className="landing-stack">
      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title">NRM Library explorer</h2>
            <p className="panel__subtitle">
              Browse canonical elements, understand measurement rules, and distribute guidance to delivery teams.
            </p>
          </div>
          <div className="toolbar">
            <button type="button" className="btn btn-secondary">Export library</button>
            <button type="button" className="btn btn-primary">Publish update</button>
          </div>
        </header>

        <div className="library-grid">
          <article className="library-card">
            <h3 className="library-card__title">NRM 1 · Order of cost estimating and cost planning</h3>
            <p className="library-card__copy">
              Assemblies and elements for early-stage estimates, aligned with RIBA stages 2 & 3.
            </p>
            <dl className="library-card__meta">
              <div>
                <dt>Elements</dt>
                <dd>148</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>4 days ago</dd>
              </div>
              <div>
                <dt>Stewards</dt>
                <dd>Cost Engineering Guild</dd>
              </div>
            </dl>
            <div className="library-card__actions">
              <button type="button" className="btn btn-ghost">Open structure</button>
              <button type="button" className="btn btn-secondary">Download guidance</button>
            </div>
          </article>

          <article className="library-card">
            <h3 className="library-card__title">NRM 2 · Detailed measurement for building works</h3>
            <p className="library-card__copy">
              Elemental breakdowns and measurement rules for procurement and tendering.
            </p>
            <dl className="library-card__meta">
              <div>
                <dt>Elements</dt>
                <dd>372</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>11 days ago</dd>
              </div>
              <div>
                <dt>Stewards</dt>
                <dd>Commercial Excellence</dd>
              </div>
            </dl>
            <div className="library-card__actions">
              <button type="button" className="btn btn-ghost">Review changes</button>
              <button type="button" className="btn btn-secondary">Compare versions</button>
            </div>
          </article>

          <article className="library-card">
            <h3 className="library-card__title">NRM 3 · Maintenance and lifecycle costing</h3>
            <p className="library-card__copy">
              Components and attributes to plan asset upkeep, replacement, and lifecycle forecasting.
            </p>
            <dl className="library-card__meta">
              <div>
                <dt>Elements</dt>
                <dd>204</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>23 days ago</dd>
              </div>
              <div>
                <dt>Stewards</dt>
                <dd>Asset Strategy</dd>
              </div>
            </dl>
            <div className="library-card__actions">
              <button type="button" className="btn btn-ghost">Browse lifecycle sets</button>
              <button type="button" className="btn btn-secondary">Assign custodians</button>
            </div>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header-inline">
          <div>
            <h3 className="panel__title">Guidance highlights</h3>
            <p className="panel__subtitle">Curated notes shared with project teams during alignment.</p>
          </div>
        </header>

        <div className="guidance-list">
          <article className="guidance-card">
            <h4>Concrete frame packages</h4>
            <p>Ensure rates include curing accelerants. Use unit rate adjustments for winter pours.</p>
            <footer>
              <span>Authored by James Price</span>
              <button type="button" className="btn btn-ghost">Copy to project</button>
            </footer>
          </article>
          <article className="guidance-card">
            <h4>Mechanical services coordination</h4>
            <p>Use the mechanical services sub-codes introduced in NRM 3. Mark conflicting headers for review.</p>
            <footer>
              <span>Authored by Priya Desai</span>
              <button type="button" className="btn btn-ghost">Share update</button>
            </footer>
          </article>
          <article className="guidance-card">
            <h4>Lifecycle replacement thresholds</h4>
            <p>Apply lifecycle multipliers for assets exceeding 15-year usage. Reference the sustainability annex.</p>
            <footer>
              <span>Authored by Michael Chen</span>
              <button type="button" className="btn btn-ghost">Flag for review</button>
            </footer>
          </article>
        </div>
      </section>
    </div>
  );
};

