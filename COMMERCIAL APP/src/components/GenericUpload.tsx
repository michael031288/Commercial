import React from 'react';
import { UploadIcon, DrawingIcon, TableIcon } from './Icons';

interface GenericUploadProps {
  onSelectCSV: () => void;
  onSelectDrawing: () => void;
}

export const GenericUpload: React.FC<GenericUploadProps> = ({ onSelectCSV, onSelectDrawing }) => {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 className="panel__title" style={{ marginBottom: '12px' }}>Upload Files</h2>
        <p className="panel__subtitle">
          Choose what you'd like to upload to get started
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px',
        marginTop: '32px'
      }}>
        {/* CSV Upload Option */}
        <button
          type="button"
          onClick={onSelectCSV}
          style={{
            padding: '32px',
            border: '2px solid var(--border-soft)',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-surface)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-soft)';
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            backgroundColor: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)'
          }}>
            <TableIcon width={32} height={32} />
          </div>
          <div>
            <h3 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '18px', 
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              CSV Schedule
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '14px', 
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}>
              Upload CSV files for table management and NRM alignment
            </p>
          </div>
        </button>

        {/* Drawing Upload Option */}
        <button
          type="button"
          onClick={onSelectDrawing}
          style={{
            padding: '32px',
            border: '2px solid var(--border-soft)',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-surface)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-soft)';
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            backgroundColor: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)'
          }}>
            <DrawingIcon width={32} height={32} />
          </div>
          <div>
            <h3 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '18px', 
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              PDF Drawing
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '14px', 
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}>
              Upload PDF drawings for markup and measurement tools
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

