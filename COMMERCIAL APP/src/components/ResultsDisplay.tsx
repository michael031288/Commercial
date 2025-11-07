import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { NRMGroup, NRMElement } from '../services/geminiService';
import { FileIcon, RedoIcon, ArrowLeftIcon, ChevronRightIcon, GroupIcon, ChevronDownIcon, EnterFullScreenIcon, ExitFullScreenIcon, PlusIcon, XIcon, DashboardIcon, ListIcon } from './Icons';
import { DashboardView } from './DashboardView';

// Sub-component for the category selection view
const CategoryListView: React.FC<{
  groups: NRMGroup[];
  onSelectSection: (section: NRMGroup) => void;
}> = ({ groups, onSelectSection }) => (
  <div>
    <h3 className="panel__title">Analysis complete</h3>
    <p className="panel__subtitle">
      Your dataset is mapped to live NRM work sections. Pick one to inspect the grouped elements or export the dashboard view.
    </p>
    <div className="results-grid">
      {groups.map((group) => (
        <button
          key={group.nrmSection}
          type="button"
          onClick={() => onSelectSection(group)}
          className="result-group result-group--action"
        >
          <div className="result-group__header">
            <span className="result-group__title">{group.nrmSection}</span>
            <span className="result-group__badge">{group.elements.length} items</span>
          </div>
          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            Review grouped data
            <ChevronRightIcon width={16} height={16} />
          </div>
        </button>
      ))}
    </div>
  </div>
);

// Sub-component for the detailed view of a single category, updated to forward a ref
const CategoryDetailView = forwardRef<HTMLDivElement, {
  section: NRMGroup;
  onBack: () => void;
  isFullscreen: boolean;
}> (({ section, onBack, isFullscreen }, ref) => {
  const [elements, setElements] = useState<NRMElement[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    // This effect resets the component's state when the section prop changes.
    const newElements = JSON.parse(JSON.stringify(section.elements));
    setElements(newElements);

    const initialHeadersSet = new Set<string>();
    newElements.forEach((element: NRMElement) => {
      Object.keys(element.originalRowData).forEach(key => initialHeadersSet.add(key));
    });
    const newHeaders = Array.from(initialHeadersSet).sort();
    setHeaders(newHeaders);

    const DEFAULT_COLUMN_KEYWORDS = ['level', 'type', 'length', 'width', 'height', 'volume', 'area'];
    const initialVisible = new Set<string>();
    newHeaders.forEach(header => {
        const lowerHeader = header.toLowerCase();
        if (DEFAULT_COLUMN_KEYWORDS.some(keyword => lowerHeader.includes(keyword))) {
            initialVisible.add(header);
        }
    });
    setVisibleColumns(initialVisible);
  }, [section]);

  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [groupByColumn, setGroupByColumn] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');

  const filteredHeaders = React.useMemo(() => {
    return headers.filter(header => 
        header.toLowerCase().includes(columnSearchTerm.toLowerCase())
    );
  }, [headers, columnSearchTerm]);

  const handleSelectAllColumns = () => {
    setVisibleColumns(prev => {
        const newSet = new Set(prev);
        filteredHeaders.forEach(header => newSet.add(header));
        return newSet;
    });
  };

  const handleDeselectAllColumns = () => {
      setVisibleColumns(prev => {
          const newSet = new Set(prev);
          filteredHeaders.forEach(header => newSet.delete(header));
          return newSet;
      });
  };

  const toggleColumn = (header: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(header)) {
        newSet.delete(header);
      } else {
        newSet.add(header);
      }
      return newSet;
    });
  };

  const handleAddColumn = () => {
    const trimmedName = newColumnName.trim();
    if (trimmedName && !headers.includes(trimmedName)) {
      setHeaders(prev => [...prev, trimmedName].sort());
      setVisibleColumns(prev => new Set(prev).add(trimmedName));
      setElements(prevElements => 
        prevElements.map(el => ({
          ...el,
          originalRowData: { ...el.originalRowData, [trimmedName]: '-' }
        }))
      );
      setNewColumnName('');
      setShowAddColumn(false);
    }
  };

  const handleCellChange = (newValue: string, rowIndex: number, colKey: string) => {
    setElements(prevElements => {
        const newElements = [...prevElements];
        const elementToUpdate = newElements[rowIndex];
        if (elementToUpdate) {
            if (colKey === 'summaryText') {
                elementToUpdate.summaryText = newValue;
            } else {
                elementToUpdate.originalRowData[colKey] = newValue;
            }
        }
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
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const groupedElements = React.useMemo(() => {
    if (!groupByColumn) return null;
    const groupsMap = new Map<string, NRMElement[]>();
    elements.forEach(element => {
      const key = groupByColumn === 'summaryText'
        ? element.summaryText
        : element.originalRowData[groupByColumn] || 'N/A';

      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(element);
    });
    return groupsMap;
  }, [groupByColumn, elements]);

  const groupSummaries = React.useMemo(() => {
    if (!groupedElements) return null;
    const summaries = new Map<string, { [column: string]: number }>();
    for (const [groupKey, groupElements] of groupedElements.entries()) {
      const columnSums: { [column: string]: number } = {};
      for (const header of headers.filter(h => visibleColumns.has(h))) {
        let sum = 0;
        let isNumeric = false;
        for (const element of groupElements) {
          const valueStr = element.originalRowData[header];
          if (valueStr && !isNaN(parseFloat(valueStr))) {
            sum += parseFloat(valueStr);
            isNumeric = true;
          }
        }
        if (isNumeric) columnSums[header] = sum;
      }
      if (Object.keys(columnSums).length > 0) summaries.set(groupKey, columnSums);
    }
    return summaries;
  }, [groupedElements, visibleColumns, headers]);

  const containerClassName = isFullscreen ? 'detail-panel detail-panel--fullscreen' : undefined;
  
  const renderCell = (element: NRMElement, rowIndex: number, colKey: string) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colKey === colKey;
    const value = colKey === 'summaryText' ? element.summaryText : (element.originalRowData[colKey] || '-');
    
    if (isEditing) {
      return (
        <td key={colKey}>
          <input
            type="text"
            defaultValue={value}
            className="editable-input"
            autoFocus
            onBlur={(e) => {
              handleCellChange(e.target.value, rowIndex, colKey);
              setEditingCell(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCellChange(e.currentTarget.value, rowIndex, colKey);
                setEditingCell(null);
              } else if (e.key === 'Escape') {
                setEditingCell(null);
              }
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
  }

  return (
    <div ref={ref} className={containerClassName}>
      <button type="button" onClick={onBack} className="btn btn-ghost" style={{ marginBottom: 16 }}>
        <ArrowLeftIcon width={16} height={16} /> Back to sections
      </button>
      <h3 className="panel__title">{section.nrmSection}</h3>
      <p className="panel__subtitle">{elements.length} grouped elements · adjust columns to audit the AI output.</p>
      
      <div className="toolbar">
        <div className="floating-toolbar">
          <button type="button" className="btn btn-secondary" onClick={() => setShowColumnToggle(!showColumnToggle)}>
            Customize columns ({visibleColumns.size} selected)
          </button>
          {showColumnToggle && (
            <div className="floating-panel" role="dialog" aria-label="Customize columns">
              <div className="floating-panel__header">
                <h4 className="floating-panel__title">Show or hide data columns</h4>
                <button type="button" className="floating-panel__close" onClick={() => setShowColumnToggle(false)}>
                  <XIcon width={16} height={16} />
                </button>
              </div>
              <input
                type="text"
                className="search-field"
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
          <button type="button" className="btn btn-secondary" onClick={() => setShowAddColumn(!showAddColumn)}>
            <PlusIcon width={16} height={16} /> Add column
          </button>
          {showAddColumn && (
            <div className="floating-panel" role="dialog" aria-label="Add new column">
              <div className="floating-panel__header">
                <h4 className="floating-panel__title">Add new column</h4>
                <button type="button" className="floating-panel__close" onClick={() => setShowAddColumn(false)}>
                  <XIcon width={16} height={16} />
                </button>
              </div>
              <input
                type="text"
                className="input"
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
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Summary</span>
                  <button type="button" className="btn btn-ghost" style={{ padding: '6px 8px' }} onClick={() => handleGroupBy('summaryText')} title="Group by summary">
                    <GroupIcon width={16} height={16} />
                  </button>
                </div>
              </th>
              {headers.filter(h => visibleColumns.has(h)).map(header => (
                <th key={header} scope="col">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{header}</span>
                    <button type="button" className="btn btn-ghost" style={{ padding: '6px 8px' }} onClick={() => handleGroupBy(header)} title={`Group by ${header}`}>
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
                <tr key={element.summaryText + index}>
                  {renderCell(element, index, 'summaryText')}
                  {headers.filter(h => visibleColumns.has(h)).map(header => renderCell(element, index, header))}
                </tr>
              ))
            ) : (
              groupedElements && Array.from(groupedElements.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([groupKey, groupElements]) => (
                <React.Fragment key={groupKey}>
                  <tr className="group-row" onClick={() => toggleGroupExpansion(groupKey)}>
                    <td colSpan={visibleColumns.size + 1}>
                      <div className="group-row__title" style={{ justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {expandedGroups.has(groupKey) ? <ChevronDownIcon width={16} height={16} /> : <ChevronRightIcon width={16} height={16} />}
                          {groupKey}
                          <span className="group-row__count">{groupElements.length}</span>
                        </span>
                        <span className="muted" style={{ display: 'flex', gap: 14 }}>
                          {groupSummaries?.get(groupKey) && Object.entries(groupSummaries.get(groupKey)!).map(([col, sum]) => (
                            <span key={col}>{`Sum ${col}: ${sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</span>
                          ))}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expandedGroups.has(groupKey) && groupElements.map((element, index) => (
                    <tr key={element.summaryText + index}>
                      {renderCell(element, elements.indexOf(element), 'summaryText')}
                      {headers.filter(h => visibleColumns.has(h)).map(header => renderCell(element, elements.indexOf(element), header))}
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

interface ResultsDisplayProps {
  groups: NRMGroup[];
  fileName: string;
  onReset: () => void;
  onBack: () => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ groups, fileName, onReset, onBack }) => {
  type View = 'dashboard' | 'browse';
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedSection, setSelectedSection] = useState<NRMGroup | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const detailViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullscreen(document.fullscreenElement === detailViewRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      detailViewRef.current?.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };
  
  const handleSelectSection = (section: NRMGroup) => {
    setSelectedSection(section);
  };

  const TabButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, icon, isActive, onClick }) => {
    return (
      <button type="button" onClick={onClick} className={`pill-tab ${isActive ? 'pill-tab--active' : ''}`}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {icon}
          {label}
        </span>
      </button>
    );
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2 className="panel__title">Step 4 · Grouped results</h2>
          <div className="value-chip">
            <FileIcon width={16} height={16} />
            {fileName || 'Untitled schedule.csv'}
          </div>
        </div>
        <div className="toolbar">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            <ArrowLeftIcon width={16} height={16} /> Back
          </button>
          {selectedSection && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={toggleFullScreen}
              title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            >
              {isFullscreen ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <ExitFullScreenIcon width={16} height={16} /> Exit full screen
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <EnterFullScreenIcon width={16} height={16} /> Full screen view
                </span>
              )}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            <RedoIcon width={16} height={16} /> Start over
          </button>
        </div>
      </div>
      
      {!selectedSection ? (
        <div>
          <div className="pill-tabs" role="tablist">
            <TabButton
              label="Dashboard"
              icon={<DashboardIcon width={16} height={16} />}
              isActive={activeView === 'dashboard'}
              onClick={() => setActiveView('dashboard')}
            />
            <TabButton
              label="Browse sections"
              icon={<ListIcon width={16} height={16} />}
              isActive={activeView === 'browse'}
              onClick={() => setActiveView('browse')}
            />
          </div>
          {activeView === 'dashboard' ? (
            <DashboardView groups={groups} onSelectSection={handleSelectSection} />
          ) : (
            <CategoryListView groups={groups} onSelectSection={handleSelectSection} />
          )}
        </div>
      ) : (
        <CategoryDetailView
          ref={detailViewRef}
          section={selectedSection}
          onBack={() => setSelectedSection(null)}
          isFullscreen={isFullscreen}
        />
      )}
    </div>
  );
};