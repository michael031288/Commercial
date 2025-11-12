import React, { useMemo } from 'react';
import { NRMElementData } from '../services/geminiService';
import { ChevronRightIcon, RedoIcon } from './Icons';

interface EmptyColumnReviewProps {
  data: NRMElementData[];
  onNext: (filteredData: NRMElementData[]) => void;
  onReset: () => void;
}

interface ColumnStats {
  name: string;
  emptyCount: number;
  totalRows: number;
  isEmpty: boolean;
  fillPercentage: number;
}

export const EmptyColumnReview: React.FC<EmptyColumnReviewProps> = ({ data, onNext, onReset }) => {
  const columnStats = useMemo(() => {
    if (!data || data.length === 0) return [];

    const headers = Array.from(new Set(data.flatMap(row => Object.keys(row))));
    const stats: ColumnStats[] = headers.map(header => {
      const emptyCount = data.filter(row => {
        const value = row[header];
        return !value || value.trim() === '' || value === '-';
      }).length;
      
      const totalRows = data.length;
      const fillPercentage = ((totalRows - emptyCount) / totalRows) * 100;
      
      return {
        name: header,
        emptyCount,
        totalRows,
        isEmpty: emptyCount === totalRows,
        fillPercentage
      };
    });

    return stats.sort((a, b) => {
      // Sort by empty count (most empty first), then alphabetically
      if (a.emptyCount !== b.emptyCount) {
        return b.emptyCount - a.emptyCount;
      }
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  const emptyColumns = useMemo(() => {
    return columnStats.filter(col => col.isEmpty || col.fillPercentage < 10);
  }, [columnStats]);

  const handleDeleteEmptyColumns = () => {
    const columnsToKeep = columnStats
      .filter(col => !col.isEmpty && col.fillPercentage >= 10)
      .map(col => col.name);
    
    const filteredData = data.map(row => {
      const newRow: NRMElementData = {};
      columnsToKeep.forEach(col => {
        if (row[col] !== undefined) {
          newRow[col] = row[col];
        }
      });
      return newRow;
    });
    
    onNext(filteredData);
  };

  const handleKeepAllColumns = () => {
    onNext(data);
  };

  const getColumnStatusClass = (stats: ColumnStats) => {
    if (stats.isEmpty) return 'column-status--empty';
    if (stats.fillPercentage < 10) return 'column-status--low-data';
    if (stats.fillPercentage < 50) return 'column-status--partial';
    return 'column-status--good';
  };

  const getColumnStatusLabel = (stats: ColumnStats) => {
    if (stats.isEmpty) return 'Empty';
    if (stats.fillPercentage < 10) return 'Very Low Data';
    if (stats.fillPercentage < 50) return 'Partial';
    return 'Good';
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2 className="panel__title">Column Analysis</h2>
          <p className="panel__subtitle">
            We've analyzed your CSV columns. Columns with little or no data are highlighted in red. 
            You can choose to remove empty columns or keep them all.
          </p>
        </div>
        <button onClick={onReset} className="btn btn-ghost">
          <RedoIcon width={16} height={16} /> Start over
        </button>
      </div>

      <div className="empty-columns-summary">
        <div className="summary-card">
          <div className="summary-card__value">{emptyColumns.length}</div>
          <div className="summary-card__label">
            {emptyColumns.length === 1 ? 'Column' : 'Columns'} with little or no data
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card__value">{columnStats.length - emptyColumns.length}</div>
          <div className="summary-card__label">
            {columnStats.length - emptyColumns.length === 1 ? 'Column' : 'Columns'} with data
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card__value">{data.length}</div>
          <div className="summary-card__label">
            {data.length === 1 ? 'Row' : 'Rows'} total
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '40%' }}>Column Name</th>
              <th scope="col" style={{ width: '20%' }}>Status</th>
              <th scope="col" style={{ width: '20%' }}>Data Fill</th>
              <th scope="col" style={{ width: '20%' }}>Empty Values</th>
            </tr>
          </thead>
          <tbody>
            {columnStats.map((stats) => {
              const isProblematic = stats.isEmpty || stats.fillPercentage < 10;
              return (
                <tr 
                  key={stats.name} 
                  className={isProblematic ? 'row-empty-column' : ''}
                >
                  <td>
                    <strong>{stats.name}</strong>
                  </td>
                  <td>
                    <span className={`column-status ${getColumnStatusClass(stats)}`}>
                      {getColumnStatusLabel(stats)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ 
                        flex: 1, 
                        height: 8, 
                        backgroundColor: 'var(--border-soft)', 
                        borderRadius: 4,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${stats.fillPercentage}%`,
                          height: '100%',
                          backgroundColor: isProblematic ? 'var(--danger)' : 'var(--success)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 45 }}>
                        {stats.fillPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: stats.emptyCount > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                      {stats.emptyCount} / {stats.totalRows}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky-actions">
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={handleKeepAllColumns}
        >
          Keep all columns
        </button>
        <button 
          type="button" 
          className="btn btn-primary" 
          onClick={handleDeleteEmptyColumns}
          disabled={emptyColumns.length === 0}
        >
          {emptyColumns.length > 0 
            ? `Remove ${emptyColumns.length} empty ${emptyColumns.length === 1 ? 'column' : 'columns'}`
            : 'No empty columns to remove'
          }
          <ChevronRightIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
};

