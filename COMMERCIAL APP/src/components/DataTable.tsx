import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NRMElementData } from '../services/geminiService';
import { ScheduleViewData, PackData } from '../services/firestoreService';
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, GroupIcon, PlusIcon, RedoIcon, WandIcon, XIcon, UploadIcon, CheckCircleIcon, PackageIcon } from './Icons';
import { STANDARD_NRM_SECTIONS, STANDARD_SMM7_SECTIONS, GroupingStandard } from '../constants/nrmSections';

interface DataTableProps {
  title: string;
  description: string;
  data: NRMElementData[];
  onNext: (editedData: NRMElementData[]) => void;
  onReset: () => void;
  onBack?: () => void;
  onSkip?: (editedData: NRMElementData[]) => void;
  showStandardizeFunctionality?: boolean;
  onPublish?: (editedData: NRMElementData[]) => Promise<void>;
  showPublishButton?: boolean;
  nextButtonText?: string;
  scheduleId?: string;
  selectedView?: ScheduleViewData | null;
  onViewColumnsChange?: (columns: string[]) => void;
  onSaveView?: (viewState: {
    visibleColumns: string[];
    groupByColumn: string | null;
    expandedGroups: string[];
    showAllRows: boolean;
    showAllColumns: boolean;
  }) => void;
  onGetViewState?: (getStateFn: () => {
    visibleColumns: string[];
    groupByColumn: string | null;
    expandedGroups: string[];
    showAllRows: boolean;
    showAllColumns: boolean;
  }) => void;
  packs?: PackData[];
  onAssignViewToPack?: (viewId: string, packId: string | null) => void;
  onViewCleared?: () => void;
  onAddToPackage?: (selectedRows: NRMElementData[], packId: string) => void;
  onExportCSV?: (data: NRMElementData[]) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ 
  title, 
  description, 
  data, 
  onNext, 
  onBack, 
  onReset,
  onSkip,
  showStandardizeFunctionality = false, 
  onPublish, 
  showPublishButton = false, 
  nextButtonText = 'Next step',
  scheduleId,
  selectedView,
  onViewColumnsChange,
  onSaveView,
  onGetViewState,
  packs,
  onAssignViewToPack,
  onViewCleared,
  onAddToPackage,
  onExportCSV
}) => {
  const [elements, setElements] = useState<NRMElementData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [rowsToShow, setRowsToShow] = useState<number>(12);
  const [showAllRows, setShowAllRows] = useState<boolean>(false);
  
  // Column pagination state
  const [showAllColumns, setShowAllColumns] = useState<boolean>(false);
  const columnsToShowDefault = 5;
  
  // Publish state
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);
  
  // Grouping state - declared early so it can be used in useEffect
  const [groupByColumn, setGroupByColumn] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const newElements = JSON.parse(JSON.stringify(data));
    setElements(newElements);

    const initialHeadersSet = new Set<string>();
    newElements.forEach((element: NRMElementData) => {
      Object.keys(element).forEach(key => initialHeadersSet.add(key));
    });
    const newHeaders = Array.from(initialHeadersSet).sort();
    setHeaders(newHeaders);
    
    // Apply view if selected, otherwise show default columns
    if (selectedView && selectedView.visibleColumns.length > 0) {
      // Apply view's visible columns
      const viewColumns = selectedView.visibleColumns.filter(col => newHeaders.includes(col));
      setVisibleColumns(new Set(viewColumns));
      setShowAllColumns(selectedView.showAllColumns ?? viewColumns.length > columnsToShowDefault);
      
      // Apply grouping state
      if (selectedView.groupByColumn) {
        setGroupByColumn(selectedView.groupByColumn);
        if (selectedView.expandedGroups) {
          setExpandedGroups(new Set(selectedView.expandedGroups));
        }
      } else {
        setGroupByColumn(null);
        setExpandedGroups(new Set());
      }
      
      // Apply row visibility state
      if (selectedView.showAllRows) {
        setShowAllRows(true);
        setRowsToShow(newElements.length);
      } else {
        setShowAllRows(false);
        setRowsToShow(12);
      }
    } else {
      // Show only first 5 columns by default
      const defaultVisibleColumns = newHeaders.slice(0, columnsToShowDefault);
      setVisibleColumns(new Set(defaultVisibleColumns));
      setGroupByColumn(null);
      setExpandedGroups(new Set());
      setRowsToShow(12);
      setShowAllRows(false);
    }
    
    setPublishSuccess(false); // Reset publish success when data changes
  }, [data, selectedView]);

  // Report visible columns changes to parent
  useEffect(() => {
    if (onViewColumnsChange) {
      onViewColumnsChange(Array.from(visibleColumns));
    }
  }, [visibleColumns, onViewColumnsChange]);

  // Expose getViewState function to parent
  useEffect(() => {
    if (onGetViewState) {
      const getStateFn = () => ({
        visibleColumns: Array.from(visibleColumns),
        groupByColumn: groupByColumn,
        expandedGroups: Array.from(expandedGroups),
        showAllRows: showAllRows,
        showAllColumns: showAllColumns
      });
      onGetViewState(getStateFn);
    }
  }, [onGetViewState, visibleColumns, groupByColumn, expandedGroups, showAllRows, showAllColumns]);

  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  
  // Filter headers based on search term
  const filteredHeaders = useMemo(() => {
    if (!columnSearchTerm.trim()) {
      return headers;
    }
    const searchLower = columnSearchTerm.toLowerCase();
    return headers.filter(header => header.toLowerCase().includes(searchLower));
  }, [headers, columnSearchTerm]);
  
  // State for the new "Standardise Column" feature
  const [showStandardizeModal, setShowStandardizeModal] = useState(false);
  const [sourceColumn, setSourceColumn] = useState<string>('');
  const [targetColumn, setTargetColumn] = useState<string>('');

  // State for merge columns feature
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeColumnA, setMergeColumnA] = useState<string>('');
  const [mergeColumnB, setMergeColumnB] = useState<string>('');
  const [mergeTargetColumn, setMergeTargetColumn] = useState<string>('');
  const [conflictRows, setConflictRows] = useState<Array<{ index: number; valueA: string; valueB: string }>>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = useState<number>(0);
  const [conflictResolution, setConflictResolution] = useState<'A' | 'B' | null>(null);
  const [applyToAllConflicts, setApplyToAllConflicts] = useState(false);
  
  // State for row selection and packages
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [groupingStandard, setGroupingStandard] = useState<GroupingStandard>('NRM');
  const [selectedNRMSection, setSelectedNRMSection] = useState<string>('');

  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  const selectAllRows = () => {
    setSelectedRows(new Set(displayedRows.map((_, idx) => getRowIndex(idx))));
  };

  const deselectAllRows = () => {
    setSelectedRows(new Set());
  };

  const handleAddToPackage = () => {
    if (!selectedPackage || selectedRows.size === 0 || !onAddToPackage) return;
    
    const selectedData = Array.from(selectedRows)
      .map(index => elements[index])
      .filter(Boolean);
    
    onAddToPackage(selectedData, selectedPackage);
    setSelectedRows(new Set());
    setSelectedPackage('');
  };

  const handleExportCSV = () => {
    if (!onExportCSV) {
      // Fallback: export current elements
      const rows: string[][] = [];
      rows.push(headers);
      elements.forEach(element => {
        rows.push(headers.map(header => String(element[header] || '')));
      });
      
      const csvContent = rows.map(row => 
        row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_')}_export.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      onExportCSV(elements);
    }
  };

  const handleViewAllRows = () => {
    setShowAllRows(true);
    setRowsToShow(elements.length);
  };

  const handleNext10Rows = () => {
    setRowsToShow(prev => Math.min(prev + 10, elements.length));
  };

  const handleViewAllColumns = () => {
    setShowAllColumns(true);
    setVisibleColumns(new Set(headers));
    if (selectedView && onViewCleared) {
      onViewCleared();
    }
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    
    setIsPublishing(true);
    setPublishSuccess(false);
    try {
      await onPublish(elements);
      setPublishSuccess(true);
      // Reset success message after 3 seconds
      setTimeout(() => setPublishSuccess(false), 3000);
    } catch (error) {
      console.error('Error publishing:', error);
      alert('Failed to publish data. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Calculate which columns to display
  const displayedColumns = useMemo(() => {
    // If a view is selected, use its visible columns
    if (selectedView && selectedView.visibleColumns.length > 0) {
      return selectedView.visibleColumns.filter(col => headers.includes(col));
    }
    // Otherwise use visibleColumns state
    if (showAllColumns) {
      return Array.from(visibleColumns);
    }
    return Array.from(visibleColumns).slice(0, columnsToShowDefault);
  }, [headers, showAllColumns, visibleColumns, selectedView]);

  // Calculate which rows to display
  const displayedRows = useMemo(() => {
    if (showAllRows || groupByColumn) {
      return elements;
    }
    return elements.slice(0, rowsToShow);
  }, [elements, rowsToShow, showAllRows, groupByColumn]);

  // Get the starting index for pagination
  const getRowIndex = useCallback((displayIndex: number) => {
    if (showAllRows || groupByColumn) {
      return displayIndex;
    }
    return displayIndex; // Since we're slicing from 0, the index matches
  }, [showAllRows, groupByColumn]);

  const hasMoreRows = !showAllRows && rowsToShow < elements.length;
  const canShowNext10 = !showAllRows && rowsToShow + 10 <= elements.length;
  const hasMoreColumns = !showAllColumns && headers.length > columnsToShowDefault;

  const handleSelectAllColumns = () => {
    setVisibleColumns(new Set(headers));
    setShowAllColumns(true);
    if (selectedView && onViewCleared) {
      onViewCleared();
    }
  };
  const handleDeselectAllColumns = () => {
    setVisibleColumns(new Set());
    if (selectedView && onViewCleared) {
      onViewCleared();
    }
  };

  const toggleColumn = (header: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      newSet.has(header) ? newSet.delete(header) : newSet.add(header);
      // If user manually selects columns, treat as "show all columns" mode
      if (newSet.size > columnsToShowDefault || newSet.size !== columnsToShowDefault) {
        setShowAllColumns(true);
      }
      // If a view is selected and user manually changes columns, clear the view
      if (selectedView && onViewCleared) {
        onViewCleared();
      }
      return newSet;
    });
  };

  const handleAddColumn = () => {
    const trimmedName = newColumnName.trim();
    if (trimmedName && !headers.includes(trimmedName)) {
      setHeaders(prev => [...prev, trimmedName].sort());
      setVisibleColumns(prev => new Set(prev).add(trimmedName));
      // If showing all columns, keep that state
      if (showAllColumns) {
        setShowAllColumns(true);
      }
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

  const analyzeMergeConflicts = (columnA: string, columnB: string) => {
    const conflicts: Array<{ index: number; valueA: string; valueB: string }> = [];
    elements.forEach((element, index) => {
      const valueA = element[columnA]?.trim() || '';
      const valueB = element[columnB]?.trim() || '';
      const isEmpty = (val: string) => !val || val === '-' || val === '';
      
      if (!isEmpty(valueA) && !isEmpty(valueB) && valueA !== valueB) {
        conflicts.push({ index, valueA, valueB });
      }
    });
    return conflicts;
  };

  const handleStartMerge = () => {
    if (!mergeColumnA || !mergeColumnB || mergeColumnA === mergeColumnB) return;
    
    const conflicts = analyzeMergeConflicts(mergeColumnA, mergeColumnB);
    
    if (conflicts.length > 0) {
      setConflictRows(conflicts);
      setCurrentConflictIndex(0);
      setConflictResolution(null);
      setApplyToAllConflicts(false);
    } else {
      // No conflicts, proceed with merge
      performMerge(mergeColumnA, mergeColumnB, mergeTargetColumn || mergeColumnA, null, false);
    }
  };

  const performMerge = (
    columnA: string, 
    columnB: string, 
    targetColumn: string,
    resolution: 'A' | 'B' | null = null,
    applyToAll: boolean = false
  ) => {
    setElements(prevElements => {
      return prevElements.map((element, index) => {
        // Skip if source columns don't exist (already merged)
        if (!(columnA in element) && !(columnB in element)) {
          return element;
        }
        
        const valueA = element[columnA]?.trim() || '';
        const valueB = element[columnB]?.trim() || '';
        const isEmpty = (val: string) => !val || val === '-' || val === '';
        
        let mergedValue = '';
        
        // Check if this row has a conflict
        const conflict = conflictRows.find(c => c.index === index);
        
        if (conflict) {
          // This row has a conflict
          if (applyToAll && resolution) {
            mergedValue = resolution === 'A' ? conflict.valueA : conflict.valueB;
          } else if (resolution) {
            mergedValue = resolution === 'A' ? conflict.valueA : conflict.valueB;
          } else {
            // Conflict not resolved yet - skip this row (shouldn't happen in normal flow)
            return element;
          }
        } else {
          // No conflict - use merge logic
          if (isEmpty(valueA) && !isEmpty(valueB)) {
            mergedValue = valueB;
          } else if (!isEmpty(valueA) && isEmpty(valueB)) {
            mergedValue = valueA;
          } else if (!isEmpty(valueA) && !isEmpty(valueB)) {
            // Both have values but same - use either
            mergedValue = valueA;
          } else {
            // Both empty
            mergedValue = '';
          }
        }
        
        const newElement = { ...element };
        newElement[targetColumn] = mergedValue;
        
        // Remove source columns if target is different
        if (targetColumn !== columnA && targetColumn !== columnB) {
          delete newElement[columnA];
          delete newElement[columnB];
        } else if (targetColumn === columnA && columnA !== columnB) {
          delete newElement[columnB];
        } else if (targetColumn === columnB && columnA !== columnB) {
          delete newElement[columnA];
        }
        
        return newElement;
      });
    });
    
    // Update headers if columns were removed
    if (targetColumn !== mergeColumnA && targetColumn !== mergeColumnB) {
      setHeaders(prev => prev.filter(h => h !== mergeColumnA && h !== mergeColumnB));
    } else if (targetColumn === mergeColumnA && mergeColumnA !== mergeColumnB) {
      setHeaders(prev => prev.filter(h => h !== mergeColumnB));
    } else if (targetColumn === mergeColumnB && mergeColumnA !== mergeColumnB) {
      setHeaders(prev => prev.filter(h => h !== mergeColumnA));
    }
    
    // Reset merge state
    setShowMergeModal(false);
    setConflictRows([]);
    setCurrentConflictIndex(0);
    setConflictResolution(null);
    setApplyToAllConflicts(false);
    setMergeColumnA('');
    setMergeColumnB('');
    setMergeTargetColumn('');
  };

  const handleConflictResolution = (resolution: 'A' | 'B') => {
    setConflictResolution(resolution);
  };

  const proceedWithConflictResolution = () => {
    if (!conflictResolution) return;
    
    if (applyToAllConflicts) {
      // Apply to all conflicts
      performMerge(mergeColumnA, mergeColumnB, mergeTargetColumn || mergeColumnA, conflictResolution, true);
    } else {
      // Apply to current conflict only
      const currentConflict = conflictRows[currentConflictIndex];
      if (currentConflict) {
        const targetCol = mergeTargetColumn || mergeColumnA;
        
        setElements(prevElements => {
          const newElements = [...prevElements];
          const element = newElements[currentConflict.index];
          
          // Set the resolved value
          newElements[currentConflict.index] = {
            ...element,
            [targetCol]: conflictResolution === 'A' ? currentConflict.valueA : currentConflict.valueB
          };
          
          // Remove source columns if target is different
          if (targetCol !== mergeColumnA && targetCol !== mergeColumnB) {
            delete newElements[currentConflict.index][mergeColumnA];
            delete newElements[currentConflict.index][mergeColumnB];
          } else if (targetCol === mergeColumnA && mergeColumnA !== mergeColumnB) {
            delete newElements[currentConflict.index][mergeColumnB];
          } else if (targetCol === mergeColumnB && mergeColumnA !== mergeColumnB) {
            delete newElements[currentConflict.index][mergeColumnA];
          }
          
          return newElements;
        });
        
        // Move to next conflict or finish
        if (currentConflictIndex < conflictRows.length - 1) {
          setCurrentConflictIndex(prev => prev + 1);
          setConflictResolution(null);
        } else {
          // All conflicts resolved, complete merge for remaining rows
          performMerge(mergeColumnA, mergeColumnB, mergeTargetColumn || mergeColumnA, null, false);
        }
      }
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
    <div style={{ 
      width: '100%', 
      maxWidth: '100%', 
      overflowX: 'hidden', 
      overflowY: 'visible',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 200px)',
      minHeight: '600px'
    }}>
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
          <>
            <div className="floating-toolbar">
              <button type="button" onClick={() => setShowStandardizeModal(true)} className="btn btn-secondary">
                <WandIcon width={16} height={16} /> Standardise column
              </button>
              {showStandardizeModal && (
                <div className="modal" role="dialog" aria-label="Standardise column data">
                  <div className="floating-panel__header">
                    <h3 className="floating-panel__title">Standardise column data</h3>
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
                    Apply standardisation
                  </button>
                </div>
              )}
            </div>

            <div className="floating-toolbar">
              <button type="button" onClick={() => setShowMergeModal(true)} className="btn btn-secondary">
                <GroupIcon width={16} height={16} /> Merge columns
              </button>
              {showMergeModal && (
                <div className="modal" role="dialog" aria-label="Merge columns" style={{ maxWidth: 500 }}>
                  {conflictRows.length === 0 ? (
                    <>
                      <div className="floating-panel__header">
                        <h3 className="floating-panel__title">Merge Columns</h3>
                        <button type="button" className="floating-panel__close" onClick={() => {
                          setShowMergeModal(false);
                          setMergeColumnA('');
                          setMergeColumnB('');
                          setMergeTargetColumn('');
                        }}>
                          <XIcon width={16} height={16} />
                        </button>
                      </div>
                      <p className="muted" style={{ marginBottom: 16 }}>
                        Merge two columns into one. If Column A is empty, it takes Column B's value. If Column B is empty, it takes Column A's value. If both have values, you'll be asked to choose.
                      </p>
                      <label className="section-title" htmlFor="merge-column-a">Column A</label>
                      <select
                        id="merge-column-a"
                        className="select"
                        value={mergeColumnA}
                        onChange={(e) => setMergeColumnA(e.target.value)}
                      >
                        <option value="">Select column A</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <label className="section-title" htmlFor="merge-column-b">Column B</label>
                      <select
                        id="merge-column-b"
                        className="select"
                        value={mergeColumnB}
                        onChange={(e) => setMergeColumnB(e.target.value)}
                      >
                        <option value="">Select column B</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <label className="section-title" htmlFor="merge-target-column">Target Column (optional)</label>
                      <select
                        id="merge-target-column"
                        className="select"
                        value={mergeTargetColumn}
                        onChange={(e) => setMergeTargetColumn(e.target.value)}
                      >
                        <option value="">Use Column A (default)</option>
                        {headers.filter(h => h !== mergeColumnA && h !== mergeColumnB).map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: 16 }}
                        onClick={handleStartMerge}
                        disabled={!mergeColumnA || !mergeColumnB || mergeColumnA === mergeColumnB}
                      >
                        Start Merge
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="floating-panel__header">
                        <h3 className="floating-panel__title">
                          Resolve Conflicts ({currentConflictIndex + 1} of {conflictRows.length})
                        </h3>
                        <button type="button" className="floating-panel__close" onClick={() => {
                          setShowMergeModal(false);
                          setConflictRows([]);
                          setCurrentConflictIndex(0);
                          setConflictResolution(null);
                          setApplyToAllConflicts(false);
                          setMergeColumnA('');
                          setMergeColumnB('');
                          setMergeTargetColumn('');
                        }}>
                          <XIcon width={16} height={16} />
                        </button>
                      </div>
                      <p className="muted" style={{ marginBottom: 16 }}>
                        Both columns have values. Choose which value to keep for this row.
                      </p>
                      {currentConflictIndex < conflictRows.length && (
                        <>
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ 
                              padding: 12, 
                              border: '1px solid var(--border-soft)', 
                              borderRadius: 8,
                              marginBottom: 8,
                              cursor: 'pointer',
                              backgroundColor: conflictResolution === 'A' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                              borderColor: conflictResolution === 'A' ? 'var(--accent-primary)' : 'var(--border-soft)'
                            }} onClick={() => handleConflictResolution('A')}>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Column A: <strong>{mergeColumnA}</strong>
                              </div>
                              <div style={{ fontSize: 14 }}>
                                {conflictRows[currentConflictIndex].valueA}
                              </div>
                            </div>
                            <div style={{ 
                              padding: 12, 
                              border: '1px solid var(--border-soft)', 
                              borderRadius: 8,
                              cursor: 'pointer',
                              backgroundColor: conflictResolution === 'B' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                              borderColor: conflictResolution === 'B' ? 'var(--accent-primary)' : 'var(--border-soft)'
                            }} onClick={() => handleConflictResolution('B')}>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Column B: <strong>{mergeColumnB}</strong>
                              </div>
                              <div style={{ fontSize: 14 }}>
                                {conflictRows[currentConflictIndex].valueB}
                              </div>
                            </div>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <input
                              type="checkbox"
                              checked={applyToAllConflicts}
                              onChange={(e) => setApplyToAllConflicts(e.target.checked)}
                            />
                            <span style={{ fontSize: 13 }}>Apply this choice to all {conflictRows.length} conflicts</span>
                          </label>
                          {conflictResolution && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ width: '100%' }}
                              onClick={proceedWithConflictResolution}
                            >
                              {applyToAllConflicts 
                                ? `Apply "${conflictResolution === 'A' ? mergeColumnA : mergeColumnB}" to all conflicts`
                                : currentConflictIndex < conflictRows.length - 1 
                                  ? 'Next Conflict'
                                  : 'Complete Merge'
                              }
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="table-wrapper" style={{ 
        width: '100%', 
        maxWidth: '100%',
        overflowX: 'auto',
        overflowY: 'auto',
        border: '1px solid var(--border-soft)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-surface)',
        position: 'relative',
        boxSizing: 'border-box',
        minWidth: 0, // Allows flex children to shrink below content size
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <table className="table" style={{ 
          width: 'max-content', 
          minWidth: '100%',
          tableLayout: 'auto', 
          margin: 0,
          flex: '0 0 auto'
        }}>
          <thead>
            <tr>
              <th scope="col" style={{ whiteSpace: 'nowrap', width: '60px', position: 'sticky', top: 0, left: 0, backgroundColor: 'var(--bg-surface)', zIndex: 2 }}>
                Select
              </th>
              {headers.filter(h => visibleColumns.has(h)).map(header => (
                <th key={header} scope="col" style={{ whiteSpace: 'nowrap', minWidth: '120px', position: 'sticky', top: 0, backgroundColor: 'var(--bg-surface)', zIndex: 1 }}>
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
              displayedRows.map((element, displayIndex) => {
                const originalIndex = getRowIndex(displayIndex);
                return (
                  <tr key={originalIndex} className={selectedRows.has(originalIndex) ? 'row-selected' : ''}>
                    <td style={{ position: 'sticky', left: 0, backgroundColor: selectedRows.has(originalIndex) ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface)', zIndex: 1 }}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(originalIndex)}
                        onChange={() => toggleRowSelection(originalIndex)}
                      />
                    </td>
                    {headers.filter(h => visibleColumns.has(h)).map(header => renderCell(element, originalIndex, header))}
                  </tr>
                );
              })
            ) : (
              groupedElements && Array.from(groupedElements.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([groupKey, groupElements]) => {
                // Get indices of all elements in this group
                const groupIndices = groupElements.map(el => elements.indexOf(el)).filter(idx => idx !== -1);
                const allSelected = groupIndices.length > 0 && groupIndices.every(idx => selectedRows.has(idx));
                const someSelected = groupIndices.some(idx => selectedRows.has(idx));
                
                const toggleGroupSelection = (e: React.MouseEvent) => {
                  e.stopPropagation(); // Prevent toggling group expansion
                  if (allSelected) {
                    // Deselect all items in group
                    setSelectedRows(prev => {
                      const newSet = new Set(prev);
                      groupIndices.forEach(idx => newSet.delete(idx));
                      return newSet;
                    });
                  } else {
                    // Select all items in group
                    setSelectedRows(prev => {
                      const newSet = new Set(prev);
                      groupIndices.forEach(idx => newSet.add(idx));
                      return newSet;
                    });
                  }
                };
                
                return (
                  <React.Fragment key={groupKey}>
                    <tr className="group-row">
                      <td style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-surface)', zIndex: 1 }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={toggleGroupSelection}
                          onClick={(e) => e.stopPropagation()}
                          title={allSelected ? 'Deselect all in group' : 'Select all in group'}
                        />
                      </td>
                      <td 
                        colSpan={visibleColumns.size}
                        onClick={() => toggleGroupExpansion(groupKey)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="group-row__title">
                          {expandedGroups.has(groupKey) ? <ChevronDownIcon width={16} height={16} /> : <ChevronRightIcon width={16} height={16} />}
                          {groupKey}
                          <span className="group-row__count">{groupElements.length}</span>
                        </div>
                      </td>
                    </tr>
                  {expandedGroups.has(groupKey) && groupElements.map((element, idx) => {
                    const originalIndex = elements.indexOf(element);
                    return (
                      <tr key={`${groupKey}-${idx}`} className={selectedRows.has(originalIndex) ? 'row-selected' : ''}>
                        <td style={{ position: 'sticky', left: 0, backgroundColor: selectedRows.has(originalIndex) ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface)', zIndex: 1 }}>
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

      {/* Column Pagination Controls */}
      {hasMoreColumns && (
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'center', 
          padding: '12px',
          borderTop: '1px solid var(--border-soft)',
          backgroundColor: 'var(--bg-surface-muted)'
        }}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleViewAllColumns}
          >
            View All Columns ({headers.length} total)
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {!groupByColumn && hasMoreRows && (
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'center', 
          padding: '16px',
          borderTop: '1px solid var(--border-soft)',
          backgroundColor: 'var(--bg-surface-muted)'
        }}>
          {canShowNext10 && (
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleNext10Rows}
            >
              Next 10 rows
            </button>
          )}
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleViewAllRows}
          >
            View All Rows ({elements.length} total)
          </button>
        </div>
      )}

      <div className="table-companion">
        <span><strong>{displayedRows.length}</strong> of <strong>{elements.length}</strong> rows visible · {visibleColumns.size} columns selected</span>
        {groupByColumn && <span>Grouped by <strong>{groupByColumn}</strong>. Toggle rows to inspect values.</span>}
        {selectedRows.size > 0 && (
          <span style={{ marginLeft: '16px', color: 'var(--accent-primary)' }}>
            <strong>{selectedRows.size}</strong> row{selectedRows.size !== 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      {/* Package selection and actions */}
      {selectedRows.size > 0 && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-soft)',
          backgroundColor: 'var(--bg-surface-muted)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* NRM/SMM7 Section Selection */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Add to:
            </label>
            <div className="pill-tabs" style={{ padding: 2 }}>
              <button
                type="button"
                className={`pill-tab ${groupingStandard === 'NRM' ? 'pill-tab--active' : ''}`}
                onClick={() => {
                  setGroupingStandard('NRM');
                  setSelectedNRMSection('');
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
                  setSelectedNRMSection('');
                }}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                SMM7
              </button>
            </div>
            <select
              value={selectedNRMSection}
              onChange={(e) => setSelectedNRMSection(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border-strong)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                cursor: 'pointer',
                minWidth: '250px'
              }}
            >
              <option value="">Select {groupingStandard} section...</option>
              {(groupingStandard === 'NRM' ? STANDARD_NRM_SECTIONS : STANDARD_SMM7_SECTIONS).map(section => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (!selectedNRMSection || selectedRows.size === 0) return;
                
                // Add NRM/SMM7 section to selected rows
                const selectedData = Array.from(selectedRows)
                  .map(index => elements[index])
                  .filter(Boolean);
                
                // Update elements with the NRM/SMM7 section
                setElements(prevElements => {
                  const newElements = [...prevElements];
                  selectedData.forEach(selectedElement => {
                    const index = newElements.findIndex(el => el === selectedElement);
                    if (index !== -1) {
                      // Add or update the NRM section field
                      const sectionField = groupingStandard === 'NRM' ? 'NRMSection' : 'SMM7Section';
                      newElements[index] = {
                        ...newElements[index],
                        [sectionField]: selectedNRMSection
                      };
                    }
                  });
                  return newElements;
                });
                
                // Show success message
                alert(`Successfully assigned ${selectedRows.size} rows to ${selectedNRMSection}!`);
                setSelectedRows(new Set());
                setSelectedNRMSection('');
              }}
              disabled={!selectedNRMSection}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <GroupIcon width={16} height={16} />
              Add to {groupingStandard}
            </button>
          </div>

          {/* Package Selection (if packs available) */}
          {packs && packs.length > 0 && (
            <>
              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-soft)' }} />
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minWidth: '200px'
                }}
              >
                <option value="">Select a package...</option>
                {packs.map(pack => (
                  <option key={pack.id} value={pack.id}>{pack.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddToPackage}
                disabled={!selectedPackage}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <PackageIcon width={16} height={16} />
                Add to Package
              </button>
            </>
          )}
        </div>
      )}

      <div className="sticky-actions">
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={handleExportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <UploadIcon width={16} height={16} />
          Export CSV
        </button>
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            <ArrowLeftIcon width={16} height={16} /> Back
          </button>
        )}
        {onSkip && (
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => onSkip(elements)}
          >
            Skip standardisation
          </button>
        )}
        {showPublishButton && onPublish && (
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handlePublish}
            disabled={isPublishing}
            style={{ 
              backgroundColor: publishSuccess ? 'var(--success)' : undefined,
              color: publishSuccess ? 'white' : undefined
            }}
          >
            {isPublishing ? (
              <>Publishing...</>
            ) : publishSuccess ? (
              <>
                <CheckCircleIcon width={16} height={16} style={{ marginRight: '6px' }} />
                Published
              </>
            ) : (
              <>
                <UploadIcon width={16} height={16} style={{ marginRight: '6px' }} />
                Publish to Schedules
              </>
            )}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => onNext(elements)}>
          {nextButtonText} <ChevronRightIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
};