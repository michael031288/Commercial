import React, { useState, useEffect, useMemo } from 'react';
import { NRMElementData } from '../services/geminiService';
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, GroupIcon, PlusIcon, RedoIcon, WandIcon, XIcon } from './Icons';

interface DataTableProps {
  title: string;
  description: string;
  data: NRMElementData[];
  onNext: (editedData: NRMElementData[]) => void;
  onReset: () => void;
  onBack?: () => void;
  showStandardizeFunctionality?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({ title, description, data, onNext, onBack, onReset, showStandardizeFunctionality = false }) => {
  const [elements, setElements] = useState<NRMElementData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const newElements = JSON.parse(JSON.stringify(data));
    setElements(newElements);

    const initialHeadersSet = new Set<string>();
    newElements.forEach((element: NRMElementData) => {
      Object.keys(element).forEach(key => initialHeadersSet.add(key));
    });
    const newHeaders = Array.from(initialHeadersSet).sort();
    setHeaders(newHeaders);
    setVisibleColumns(new Set(newHeaders)); // Show all columns by default
  }, [data]);

  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [groupByColumn, setGroupByColumn] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  
  // State for the new "Standardize Column" feature
  const [showStandardizeModal, setShowStandardizeModal] = useState(false);
  const [sourceColumn, setSourceColumn] = useState<string>('');
  const [targetColumn, setTargetColumn] = useState<string>('');

  const filteredHeaders = useMemo(() => {
    return headers.filter(header => 
        header.toLowerCase().includes(columnSearchTerm.toLowerCase())
    );
  }, [headers, columnSearchTerm]);

  const handleSelectAllColumns = () => setVisibleColumns(new Set(headers));
  const handleDeselectAllColumns = () => setVisibleColumns(new Set());

  const toggleColumn = (header: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      newSet.has(header) ? newSet.delete(header) : newSet.add(header);
      return newSet;
    });
  };

  const handleAddColumn = () => {
    const trimmedName = newColumnName.trim();
    if (trimmedName && !headers.includes(trimmedName)) {
      setHeaders(prev => [...prev, trimmedName].sort());
      setVisibleColumns(prev => new Set(prev).add(trimmedName));
      setElements(prevElements => 
        prevElements.map(el => ({ ...el, [trimmedName]: '-' }))
      );
      setNewColumnName('');
      setShowAddColumn(false);
    }
  };

  const handleCellChange = (newValue: string, rowIndex: number, colKey: string) => {
    setElements(prevElements => {
      const newElements = [...prevElements];
      newElements[rowIndex] = { ...newElements[rowIndex], [colKey]: newValue };
      return newElements;
    });
  };

  const handleGroupBy = (header: string) => {
    setGroupByColumn(prev => (prev === header ? null : header));
    setExpandedGroups(new Set());
  };

  const toggleGroupExpansion = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      newSet.has(groupKey) ? newSet.delete(groupKey) : newSet.add(groupKey);
      return newSet;
    });
  };

  const handleStandardizeColumnData = () => {
    if (sourceColumn && targetColumn && sourceColumn !== targetColumn) {
      setElements(prevElements => {
        return prevElements.map(el => ({
          ...el,
          [targetColumn]: el[sourceColumn] || '-',
        }));
      });
      setShowStandardizeModal(false);
      setSourceColumn('');
      setTargetColumn('');
    }
  };

  const groupedElements = useMemo(() => {
    if (!groupByColumn) return null;
    const groupsMap = new Map<string, NRMElementData[]>();
    elements.forEach(element => {
      const key = element[groupByColumn] || 'N/A';
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(element);
    });
    return groupsMap;
  }, [groupByColumn, elements]);

  const renderCell = (element: NRMElementData, rowIndex: number, colKey: string) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colKey === colKey;
    const value = element[colKey] || '-';
    
    if (isEditing) {
      return (
        <td key={colKey}>
          <input
            type="text"
            defaultValue={value}
            className="editable-input"
            autoFocus
            onBlur={(e) => { handleCellChange(e.target.value, rowIndex, colKey); setEditingCell(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { handleCellChange(e.currentTarget.value, rowIndex, colKey); setEditingCell(null); }
              if (e.key === 'Escape') setEditingCell(null);
            }}
          />
        </td>
      );
    }
    
    return (
      <td key={colKey} className="editable-cell" onClick={() => setEditingCell({ rowIndex, colKey })}>
        {value}
      </td>
    );
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2 className="panel__title">{title}</h2>
          <p className="panel__subtitle">{description}</p>
        </div>
        <button onClick={onReset} className="btn btn-ghost">
          <RedoIcon width={16} height={16} /> Start over
        </button>
      </div>

      <div className="toolbar">
        <div className="floating-toolbar">
          <button type="button" onClick={() => setShowColumnToggle(!showColumnToggle)} className="btn btn-secondary">
            Customize columns ({visibleColumns.size})
          </button>
          {showColumnToggle && (
            <div className="floating-panel" role="dialog" aria-label="Customize columns">
              <div className="floating-panel__header">
                <h3 className="floating-panel__title">Show or hide columns</h3>
                <button type="button" className="floating-panel__close" onClick={() => setShowColumnToggle(false)}>
                  <XIcon width={16} height={16} />
                </button>
              </div>
              <input
                className="search-field"
                type="text"
                placeholder="Search columns"
                value={columnSearchTerm}
                onChange={(e) => setColumnSearchTerm(e.target.value)}
              />
              <div className="chips">
                <button type="button" className="btn btn-ghost" onClick={handleSelectAllColumns}>Select all</button>
                <button type="button" className="btn btn-ghost" onClick={handleDeselectAllColumns}>Hide all</button>
              </div>
              <div className="option-list">
                {filteredHeaders.map(header => (
                  <label key={header} className="option-item">
                    <input type="checkbox" checked={visibleColumns.has(header)} onChange={() => toggleColumn(header)} />
                    <span>{header}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="floating-toolbar">
          <button type="button" onClick={() => setShowAddColumn(!showAddColumn)} className="btn btn-secondary">
            <PlusIcon width={16} height={16} /> Add column
          </button>
          {showAddColumn && (
            <div className="floating-panel" role="dialog" aria-label="Add column">
              <div className="floating-panel__header">
                <h3 className="floating-panel__title">Add new column</h3>
                <button type="button" className="floating-panel__close" onClick={() => setShowAddColumn(false)}>
                  <XIcon width={16} height={16} />
                </button>
              </div>
              <input
                className="input"
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Enter column name"
              />
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={handleAddColumn}>
                Add column
              </button>
            </div>
          )}
        </div>

        {showStandardizeFunctionality && (
          <div className="floating-toolbar">
            <button type="button" onClick={() => setShowStandardizeModal(true)} className="btn btn-secondary">
              <WandIcon width={16} height={16} /> Standardize column
            </button>
            {showStandardizeModal && (
              <div className="modal" role="dialog" aria-label="Standardize column data">
                <div className="floating-panel__header">
                  <h3 className="floating-panel__title">Standardize column data</h3>
                  <button type="button" className="floating-panel__close" onClick={() => setShowStandardizeModal(false)}>
                    <XIcon width={16} height={16} />
                  </button>
                </div>
                <label className="section-title" htmlFor="source-column">Copy values from</label>
                <select
                  id="source-column"
                  className="select"
                  value={sourceColumn}
                  onChange={(e) => setSourceColumn(e.target.value)}
                >
                  <option value="">Select a source column</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <label className="section-title" htmlFor="target-column">Paste values to</label>
                <select
                  id="target-column"
                  className="select"
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                >
                  <option value="">Select a target column</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 16 }}
                  onClick={handleStandardizeColumnData}
                  disabled={!sourceColumn || !targetColumn || sourceColumn === targetColumn}
                >
                  Apply standardization
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              {headers.filter(h => visibleColumns.has(h)).map(header => (
                <th key={header} scope="col">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{header}</span>
                    <button
                      type="button"
                      onClick={() => handleGroupBy(header)}
                      title={`Group by ${header}`}
                      className="btn btn-ghost"
                      style={{ padding: '6px 8px' }}
                    >
                      <GroupIcon width={16} height={16} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!groupByColumn ? (
              elements.map((element, index) => (
                <tr key={index}>
                  {headers.filter(h => visibleColumns.has(h)).map(header => renderCell(element, index, header))}
                </tr>
              ))
            ) : (
              groupedElements && Array.from(groupedElements.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([groupKey, groupElements]) => (
                <React.Fragment key={groupKey}>
                  <tr className="group-row" onClick={() => toggleGroupExpansion(groupKey)}>
                    <td colSpan={visibleColumns.size}>
                      <div className="group-row__title">
                        {expandedGroups.has(groupKey) ? <ChevronDownIcon width={16} height={16} /> : <ChevronRightIcon width={16} height={16} />}
                        {groupKey}
                        <span className="group-row__count">{groupElements.length}</span>
                      </div>
                    </td>
                  </tr>
                  {expandedGroups.has(groupKey) && groupElements.map((element, idx) => (
                    <tr key={`${groupKey}-${idx}`}>
                      {headers.filter(h => visibleColumns.has(h)).map(header => renderCell(element, elements.indexOf(element), header))}
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-companion">
        <span><strong>{elements.length}</strong> rows visible · {visibleColumns.size} columns selected</span>
        {groupByColumn && <span>Grouped by <strong>{groupByColumn}</strong>. Toggle rows to inspect values.</span>}
      </div>

      <div className="sticky-actions">
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            <ArrowLeftIcon width={16} height={16} /> Back
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => onNext(elements)}>
          Next step <ChevronRightIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
};