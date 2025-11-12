import React, { useState, useEffect, useMemo } from 'react';
import { NRMElementData, NRMGroup, NRMElement } from '../services/geminiService';
import { ArrowLeftIcon, ChevronRightIcon, ChevronDownIcon, RedoIcon, XIcon, WandIcon, PackageIcon, TrashIcon, GroupIcon, PlusIcon } from './Icons';
import { STANDARD_NRM_SECTIONS, STANDARD_SMM7_SECTIONS, GroupingStandard } from '../constants/nrmSections';

interface ManualGroupingProps {
  data: NRMElementData[];
  onComplete: (groups: NRMGroup[], excludedRows: NRMElementData[]) => void;
  onBack: () => void;
  onReset: () => void;
  onRunAI: (remainingData: NRMElementData[]) => void;
}

type View = 'table' | 'packages';

export const ManualGrouping: React.FC<ManualGroupingProps> = ({ 
  data, 
  onComplete, 
  onBack, 
  onReset,
  onRunAI 
}) => {
  const [remainingData, setRemainingData] = useState<NRMElementData[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [packages, setPackages] = useState<Map<string, NRMElementData[]>>(new Map());
  const [excludedRows, setExcludedRows] = useState<NRMElementData[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [activeView, setActiveView] = useState<View>('table');
  const [headers, setHeaders] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [groupByColumn, setGroupByColumn] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [groupingStandard, setGroupingStandard] = useState<GroupingStandard>('NRM');

  useEffect(() => {
    const newData = JSON.parse(JSON.stringify(data));
    setRemainingData(newData);

    const initialHeadersSet = new Set<string>();
    newData.forEach((element: NRMElementData) => {
      Object.keys(element).forEach(key => initialHeadersSet.add(key));
    });
    const newHeaders = Array.from(initialHeadersSet).sort();
    setHeaders(newHeaders);
    setVisibleColumns(new Set(newHeaders));
  }, [data]);

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
      setRemainingData(prevElements => 
        prevElements.map(el => ({ ...el, [trimmedName]: '-' }))
      );
      setNewColumnName('');
      setShowAddColumn(false);
    }
  };

  const handleCellChange = (newValue: string, rowIndex: number, colKey: string) => {
    setRemainingData(prevElements => {
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

  const groupedElements = useMemo(() => {
    if (!groupByColumn) return null;
    const groupsMap = new Map<string, NRMElementData[]>();
    remainingData.forEach((element) => {
      const key = element[groupByColumn] || 'N/A';
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(element);
    });
    return groupsMap;
  }, [groupByColumn, remainingData]);

  const toggleRowSelection = (index: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleGroupSelection = (groupKey: string) => {
    if (!groupedElements) return;
    const groupItems = groupedElements.get(groupKey) || [];
    const groupIndices = groupItems.map(item => remainingData.indexOf(item)).filter(idx => idx !== -1);
    const allSelected = groupIndices.every(idx => selectedRows.has(idx));
    
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        groupIndices.forEach(idx => newSet.delete(idx));
      } else {
        groupIndices.forEach(idx => newSet.add(idx));
      }
      return newSet;
    });
  };

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

  const selectAllRows = () => {
    setSelectedRows(new Set(remainingData.map((_, i) => i)));
  };

  const deselectAllRows = () => {
    setSelectedRows(new Set());
  };

  const assignToPackage = () => {
    if (!selectedPackage || selectedRows.size === 0) return;

    const selectedData = Array.from(selectedRows)
      .map(index => remainingData[index])
      .filter(Boolean);

    setPackages(prev => {
      const newPackages = new Map(prev);
      const existing = newPackages.get(selectedPackage) || [];
      newPackages.set(selectedPackage, [...existing, ...selectedData]);
      return newPackages;
    });

    // Remove assigned rows from remaining data
    setRemainingData(prev => 
      prev.filter((_, index) => !selectedRows.has(index))
    );
    setSelectedRows(new Set());
    setSelectedPackage('');
  };

  const excludeRows = () => {
    const selectedData = Array.from(selectedRows)
      .map(index => remainingData[index])
      .filter(Boolean);

    setExcludedRows(prev => [...prev, ...selectedData]);
    setRemainingData(prev => 
      prev.filter((_, index) => !selectedRows.has(index))
    );
    setSelectedRows(new Set());
  };

  const deleteRows = () => {
    setRemainingData(prev => 
      prev.filter((_, index) => !selectedRows.has(index))
    );
    setSelectedRows(new Set());
  };

  const removeFromPackage = (packageName: string, index: number) => {
    setPackages(prev => {
      const newPackages = new Map(prev);
      const packageData = newPackages.get(packageName);
      if (packageData) {
        const updated = packageData.filter((_, i) => i !== index);
        if (updated.length === 0) {
          newPackages.delete(packageName);
        } else {
          newPackages.set(packageName, updated);
        }
      }
      return newPackages;
    });
  };

  const ungroupFromPackage = (packageName: string, index: number) => {
    setPackages(prev => {
      const newPackages = new Map(prev);
      const packageData = newPackages.get(packageName);
      if (packageData) {
        const row = packageData[index];
        setRemainingData(prevData => [...prevData, row]);
        const updated = packageData.filter((_, i) => i !== index);
        if (updated.length === 0) {
          newPackages.delete(packageName);
        } else {
          newPackages.set(packageName, updated);
        }
      }
      return newPackages;
    });
  };

  const handleComplete = () => {
    // Convert packages to NRMGroup format
    const groups: NRMGroup[] = Array.from(packages.entries()).map(([nrmSection, elements]) => ({
      nrmSection,
      elements: elements.map(row => ({
        summaryText: Object.values(row).join(' · ').substring(0, 100) || 'Element',
        originalRowData: row
      }))
    }));

    onComplete(groups, excludedRows);
  };

  const handleRunAI = () => {
    onRunAI(remainingData);
  };

  const packageList = Array.from(packages.entries());
  const totalGrouped = packageList.reduce((sum, [, items]) => sum + items.length, 0);

  const availableSections = groupingStandard === 'NRM' ? STANDARD_NRM_SECTIONS : STANDARD_SMM7_SECTIONS;

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2 className="panel__title">Manual Grouping</h2>
          <p className="panel__subtitle">
            Select rows and assign them to NRM packages. Review your packages in the Package Manager.
          </p>
        </div>
        <button onClick={onReset} className="btn btn-ghost">
          <RedoIcon width={16} height={16} /> Start over
        </button>
      </div>

      <div className="manual-grouping-stats">
        <div className="stat-card">
          <div className="stat-card__value">{remainingData.length}</div>
          <div className="stat-card__label">Remaining rows</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{totalGrouped}</div>
          <div className="stat-card__label">Grouped rows</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{packages.size}</div>
          <div className="stat-card__label">Packages</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{excludedRows.length}</div>
          <div className="stat-card__label">Excluded</div>
        </div>
      </div>

      <div className="pill-tabs" role="tablist" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`pill-tab ${activeView === 'table' ? 'pill-tab--active' : ''}`}
          onClick={() => setActiveView('table')}
        >
          Table View ({remainingData.length})
        </button>
        <button
          type="button"
          className={`pill-tab ${activeView === 'packages' ? 'pill-tab--active' : ''}`}
          onClick={() => setActiveView('packages')}
        >
          Package Manager ({packages.size})
        </button>
      </div>

      {activeView === 'table' ? (
        <div>
          {remainingData.length > 0 ? (
            <>
              <div className="toolbar" style={{ marginBottom: 16 }}>
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

                <div className="floating-toolbar">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      Grouping Standard:
                    </label>
                    <div className="pill-tabs" style={{ padding: 2 }}>
                      <button
                        type="button"
                        className={`pill-tab ${groupingStandard === 'NRM' ? 'pill-tab--active' : ''}`}
                        onClick={() => {
                          setGroupingStandard('NRM');
                          setSelectedPackage('');
                        }}
                        style={{ fontSize: 12, padding: '4px 12px' }}
                      >
                        NRM
                      </button>
                      <button
                        type="button"
                        className={`pill-tab ${groupingStandard === 'SMM7' ? 'pill-tab--active' : ''}`}
                        onClick={() => {
                          setGroupingStandard('SMM7');
                          setSelectedPackage('');
                        }}
                        style={{ fontSize: 12, padding: '4px 12px' }}
                      >
                        SMM7
                      </button>
                    </div>
                  </div>
                </div>

                <div className="floating-toolbar">
                  <select
                    className="select"
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    style={{ minWidth: 300 }}
                  >
                    <option value="">Select {groupingStandard} package...</option>
                    {availableSections.map(section => (
                      <option key={section} value={section}>{section}</option>
                    ))}
                  </select>
                </div>
                <div className="floating-toolbar">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={assignToPackage}
                    disabled={selectedRows.size === 0 || !selectedPackage}
                  >
                    Assign to Package
                  </button>
                </div>
                <div className="floating-toolbar">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={excludeRows}
                    disabled={selectedRows.size === 0}
                  >
                    Exclude from Schedule
                  </button>
                </div>
                <div className="floating-toolbar">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={deleteRows}
                    disabled={selectedRows.size === 0}
                    style={{ color: 'var(--danger)' }}
                  >
                    <TrashIcon width={16} height={16} /> Delete
                  </button>
                </div>
              </div>

              <div className="selection-actions" style={{ marginBottom: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={selectAllRows}>
                  Select all ({remainingData.length})
                </button>
                <button type="button" className="btn btn-ghost" onClick={deselectAllRows}>
                  Deselect all
                </button>
                {selectedRows.size > 0 && (
                  <span className="muted" style={{ marginLeft: 12 }}>
                    {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
                  </span>
                )}
              </div>

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.size === remainingData.length && remainingData.length > 0}
                          onChange={selectedRows.size === remainingData.length ? deselectAllRows : selectAllRows}
                        />
                      </th>
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
                      remainingData.map((row, index) => (
                        <tr key={index} className={selectedRows.has(index) ? 'row-selected' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedRows.has(index)}
                              onChange={() => toggleRowSelection(index)}
                            />
                          </td>
                          {headers.filter(h => visibleColumns.has(h)).map(header => renderCell(row, index, header))}
                        </tr>
                      ))
                    ) : (
                      groupedElements && Array.from(groupedElements.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([groupKey, groupElements]) => {
                        const groupIndices = groupElements.map(item => remainingData.indexOf(item)).filter(idx => idx !== -1);
                        const allSelected = groupIndices.length > 0 && groupIndices.every(idx => selectedRows.has(idx));
                        const someSelected = groupIndices.some(idx => selectedRows.has(idx));
                        
                        return (
                          <React.Fragment key={groupKey}>
                            <tr className="group-row" onClick={() => toggleGroupExpansion(groupKey)}>
                              <td onClick={(e) => { e.stopPropagation(); toggleGroupSelection(groupKey); }}>
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(input) => {
                                    if (input) input.indeterminate = someSelected && !allSelected;
                                  }}
                                  onChange={() => toggleGroupSelection(groupKey)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td colSpan={visibleColumns.size}>
                                <div className="group-row__title">
                                  {expandedGroups.has(groupKey) ? <ChevronDownIcon width={16} height={16} /> : <ChevronRightIcon width={16} height={16} />}
                                  {groupKey}
                                  <span className="group-row__count">{groupElements.length}</span>
                                </div>
                              </td>
                            </tr>
                            {expandedGroups.has(groupKey) && groupElements.map((element, idx) => {
                              const originalIndex = remainingData.indexOf(element);
                              return (
                                <tr key={`${groupKey}-${idx}`} className={selectedRows.has(originalIndex) ? 'row-selected' : ''}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={selectedRows.has(originalIndex)}
                                      onChange={() => toggleRowSelection(originalIndex)}
                                    />
                                  </td>
                                  {headers.filter(h => visibleColumns.has(h)).map(header => renderCell(element, originalIndex, header))}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-companion">
                <span><strong>{remainingData.length}</strong> rows visible · {visibleColumns.size} columns selected</span>
                {groupByColumn && <span>Grouped by <strong>{groupByColumn}</strong>. Toggle rows to inspect values.</span>}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>All rows have been assigned to packages or excluded.</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {packageList.length > 0 ? (
            <div className="package-list">
              {packageList.map(([packageName, items]) => (
                <div key={packageName} className="package-card">
                  <div className="package-card__header">
                    <h3 className="package-card__title">{packageName}</h3>
                    <span className="package-card__badge">{items.length} items</span>
                  </div>
                  <div className="table-wrapper">
                    <table className="table table--compact">
                      <thead>
                        <tr>
                          {headers.filter(h => visibleColumns.has(h)).slice(0, 5).map(header => (
                            <th key={header} scope="col">{header}</th>
                          ))}
                          <th scope="col" style={{ width: 100 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((row, index) => (
                          <tr key={index}>
                            {headers.filter(h => visibleColumns.has(h)).slice(0, 5).map(header => (
                              <td key={header}>{row[header] || '-'}</td>
                            ))}
                            <td>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => ungroupFromPackage(packageName, index)}
                                  title="Ungroup"
                                >
                                  <ArrowLeftIcon width={14} height={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => removeFromPackage(packageName, index)}
                                  title="Remove"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  <XIcon width={14} height={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No packages created yet. Assign rows to packages in the Table View.</p>
            </div>
          )}
        </div>
      )}

      <div className="sticky-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeftIcon width={16} height={16} /> Back
        </button>
        {remainingData.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRunAI}
          >
            <WandIcon width={16} height={16} /> Run AI on Remaining ({remainingData.length})
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleComplete}
          disabled={packageList.length === 0}
        >
          Complete Manual Grouping
          <ChevronRightIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
};

