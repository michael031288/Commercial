import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CSVUploadData, getProjectCSVUploads, deleteCSVUpload, updateCSVUpload, PackData, getProjectPacks, savePack, updatePack, deletePack, ScheduleViewData, getScheduleViews, saveScheduleView, updateScheduleView, deleteScheduleView, loadCSVUploadData } from '../services/firestoreService';
import { uploadProcessedData } from '../services/storageService';
import { TableIcon, FileIcon, TrashIcon, EyeIcon, CalendarIcon, CheckCircleIcon, ClockIcon, AlertCircleIcon, EditIcon, XIcon, ChevronDownIcon, ChevronRightIcon, PlusIcon } from './Icons';
import { OverviewLanding } from './OverviewLanding';
import { NRMGroup, NRMElementData } from '../services/geminiService';
import { DataTable } from './DataTable';

interface ScheduleManagementProps {
  userId: string;
  projectId: string;
}

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ userId, projectId }) => {
  const [schedules, setSchedules] = useState<CSVUploadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<CSVUploadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<CSVUploadData | null>(null);
  const [editForm, setEditForm] = useState({
    customName: '',
    description: '',
    icon: '',
    color: '',
    tags: [] as string[]
  });
  const [packs, setPacks] = useState<PackData[]>([]);
  const [isPackagesExpanded, setIsPackagesExpanded] = useState<boolean>(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [editingPack, setEditingPack] = useState<PackData | null>(null);
  const [newPackName, setNewPackName] = useState<string>('');
  const [scheduleViews, setScheduleViews] = useState<ScheduleViewData[]>([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingView, setEditingView] = useState<ScheduleViewData | null>(null);
  const [newViewName, setNewViewName] = useState<string>('');
  const [currentViewColumns, setCurrentViewColumns] = useState<string[]>([]);
  const [selectedView, setSelectedView] = useState<ScheduleViewData | null>(null);
  const [newViewPackId, setNewViewPackId] = useState<string | null>(null);
  const [currentViewState, setCurrentViewState] = useState<{
    visibleColumns: string[];
    groupByColumn: string | null;
    expandedGroups: string[];
    showAllRows: boolean;
    showAllColumns: boolean;
  } | null>(null);
  const [viewToDelete, setViewToDelete] = useState<ScheduleViewData | null>(null);
  const [getViewStateFn, setGetViewStateFn] = useState<(() => {
    visibleColumns: string[];
    groupByColumn: string | null;
    expandedGroups: string[];
    showAllRows: boolean;
    showAllColumns: boolean;
  }) | null>(null);

  const loadSchedules = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const uploads = await getProjectCSVUploads(userId, projectId);
      
      // Load data from Storage for schedules that have URLs but no data arrays
      // Also handle old schedules that might have empty arrays but URLs exist
      const schedulesWithData = await Promise.all(
        uploads.map(async (schedule) => {
          // Check if schedule has data arrays with actual data
          const hasDataArrays = (schedule.extractedData && schedule.extractedData.length > 0) ||
                               (schedule.standardizedData && schedule.standardizedData.length > 0) ||
                               (schedule.groupedData && schedule.groupedData.length > 0);
          
          // Check if schedule has URLs
          const hasUrls = schedule.extractedDataUrl || schedule.standardizedDataUrl || schedule.groupedDataUrl;
          
          // If schedule has URLs but no data arrays (or empty arrays), load from Storage
          if (hasUrls && !hasDataArrays) {
            try {
              const { upload, extractedData, standardizedData, groupedData } = await loadCSVUploadData(schedule.id);
              // Populate deprecated fields for backward compatibility
              return {
                ...upload,
                extractedData: extractedData || upload.extractedData || [],
                standardizedData: standardizedData || upload.standardizedData || [],
                groupedData: groupedData || upload.groupedData || []
              };
            } catch (error) {
              console.error('Error loading schedule data from Storage:', schedule.id, error);
              // Return original schedule if loading fails
              return schedule;
            }
          }
          // Return schedule as-is if it already has data arrays or no URLs
          return schedule;
        })
      );
      
      setSchedules(schedulesWithData);
    } catch (err) {
      console.error('Error loading schedules:', err);
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId]);

  const loadPacks = useCallback(async () => {
    if (!projectId) return;
    try {
      const packsData = await getProjectPacks(userId, projectId, 'schedules');
      setPacks(packsData);
    } catch (err) {
      console.error('Error loading packs:', err);
    }
  }, [userId, projectId]);

  const loadScheduleViews = useCallback(async (scheduleId: string) => {
    if (!scheduleId) return;
    try {
      const views = await getScheduleViews(userId, scheduleId);
      setScheduleViews(views);
    } catch (err) {
      console.error('Error loading schedule views:', err);
    }
  }, [userId]);

  // Load all views for all schedules (for displaying in packages)
  const loadAllScheduleViews = useCallback(async (schedulesToLoad: CSVUploadData[]) => {
    if (!projectId || schedulesToLoad.length === 0) return;
    try {
      const allViews: ScheduleViewData[] = [];
      for (const schedule of schedulesToLoad) {
        const views = await getScheduleViews(userId, schedule.id);
        allViews.push(...views);
      }
      setScheduleViews(allViews);
    } catch (err) {
      console.error('Error loading all schedule views:', err);
    }
  }, [userId, projectId]);

  useEffect(() => {
    loadSchedules();
    loadPacks();
  }, [loadSchedules, loadPacks]);

  // Load all views when schedules are loaded (only on main page, not when viewing a schedule)
  useEffect(() => {
    if (schedules.length > 0 && !selectedSchedule) {
      loadAllScheduleViews(schedules);
    }
  }, [schedules.length, selectedSchedule, loadAllScheduleViews]);

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteCSVUpload(scheduleId);
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      if (selectedSchedule?.id === scheduleId) {
        setSelectedSchedule(null);
      }
    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Failed to delete schedule. Please try again.');
    }
  };

  const handleViewSchedule = async (schedule: CSVUploadData) => {
    // Load full data from Storage if URLs exist but data arrays don't
    if ((schedule.extractedDataUrl || schedule.standardizedDataUrl || schedule.groupedDataUrl) && 
        (!schedule.extractedData && !schedule.standardizedData && !schedule.groupedData)) {
      try {
        const { upload, extractedData, standardizedData, groupedData } = await loadCSVUploadData(schedule.id);
        // Populate deprecated fields for backward compatibility
        const scheduleWithData: CSVUploadData = {
          ...upload,
          extractedData: extractedData || upload.extractedData,
          standardizedData: standardizedData || upload.standardizedData,
          groupedData: groupedData || upload.groupedData
        };
        setSelectedSchedule(scheduleWithData);
      } catch (error) {
        console.error('Error loading schedule data:', error);
        setSelectedSchedule(schedule);
      }
    } else {
      setSelectedSchedule(schedule);
    }
    setViewGroupedOverview(false); // Reset grouped overview view when selecting a schedule
    loadScheduleViews(schedule.id); // Load views for this specific schedule
    setSelectedView(null); // Reset selected view
  };

  // Handle opening a schedule with a specific view selected
  const handleViewScheduleWithView = useCallback(async (view: ScheduleViewData) => {
    // Find the schedule for this view
    const schedule = schedules.find(s => s.id === view.scheduleId);
    if (!schedule) {
      console.error('Schedule not found for view:', view.scheduleId);
      return;
    }
    
    // Load views for this schedule first
    const views = await getScheduleViews(userId, schedule.id);
    setScheduleViews(views);
    
    // Find the view from the loaded views to ensure we have the latest version
    const loadedView = views.find(v => v.id === view.id) || view;
    
    // Load full data from Storage if needed
    let scheduleToSet = schedule;
    if ((schedule.extractedDataUrl || schedule.standardizedDataUrl || schedule.groupedDataUrl) && 
        (!schedule.extractedData && !schedule.standardizedData && !schedule.groupedData)) {
      try {
        const { upload, extractedData, standardizedData, groupedData } = await loadCSVUploadData(schedule.id);
        scheduleToSet = {
          ...upload,
          extractedData: extractedData || upload.extractedData,
          standardizedData: standardizedData || upload.standardizedData,
          groupedData: groupedData || upload.groupedData
        };
      } catch (error) {
        console.error('Error loading schedule data:', error);
      }
    }
    
    // Set the schedule and selected view
    setSelectedSchedule(scheduleToSet);
    setViewGroupedOverview(false);
    setSelectedView(loadedView);
  }, [schedules, userId]);

  const handleBackToList = () => {
    setSelectedSchedule(null);
    setSelectedView(null);
    // Reload all views when going back to list
    if (schedules.length > 0) {
      loadAllScheduleViews(schedules);
    }
  };

  // View management functions
  const handleSaveView = useCallback(async (viewName: string, viewState: {
    visibleColumns: string[];
    groupByColumn: string | null;
    expandedGroups: string[];
    showAllRows: boolean;
    showAllColumns: boolean;
  }, packId?: string | null) => {
    if (!selectedSchedule || !viewName.trim() || !viewState) return;
    
    try {
      if (editingView) {
        // Update existing view
        await updateScheduleView(editingView.id, {
          name: viewName.trim(),
          visibleColumns: viewState.visibleColumns,
          groupByColumn: viewState.groupByColumn,
          expandedGroups: viewState.expandedGroups,
          showAllRows: viewState.showAllRows,
          showAllColumns: viewState.showAllColumns,
          packId: packId !== undefined ? packId : editingView.packId
        });
        setScheduleViews(prev => prev.map(v => 
          v.id === editingView.id 
            ? { 
                ...v, 
                name: viewName.trim(), 
                visibleColumns: viewState.visibleColumns,
                groupByColumn: viewState.groupByColumn,
                expandedGroups: viewState.expandedGroups,
                showAllRows: viewState.showAllRows,
                showAllColumns: viewState.showAllColumns,
                packId: packId !== undefined ? packId : v.packId 
              }
            : v
        ));
      } else {
        // Create new view
        const viewId = await saveScheduleView(userId, projectId, selectedSchedule.id, {
          name: viewName.trim(),
          visibleColumns: viewState.visibleColumns,
          groupByColumn: viewState.groupByColumn,
          expandedGroups: viewState.expandedGroups,
          showAllRows: viewState.showAllRows,
          showAllColumns: viewState.showAllColumns,
          packId: (packId && typeof packId === 'string' && packId.trim()) ? packId : undefined
        });
        const newView: ScheduleViewData = {
          id: viewId,
          scheduleId: selectedSchedule.id,
          projectId,
          userId,
          name: viewName.trim(),
          visibleColumns: viewState.visibleColumns,
          groupByColumn: viewState.groupByColumn,
          expandedGroups: viewState.expandedGroups,
          showAllRows: viewState.showAllRows,
          showAllColumns: viewState.showAllColumns,
          packId: packId || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setScheduleViews(prev => [...prev, newView]);
      }
      setShowViewModal(false);
      setEditingView(null);
      setNewViewName('');
      setCurrentViewColumns([]);
      setNewViewPackId(null);
      setCurrentViewState(null);
    } catch (error) {
      console.error('Error saving view:', error);
      alert('Failed to save view. Please try again.');
    }
  }, [userId, projectId, selectedSchedule, editingView]);

  const handleDeleteView = useCallback(async (viewId: string) => {
    try {
      await deleteScheduleView(viewId);
      setScheduleViews(prev => prev.filter(v => v.id !== viewId));
      if (selectedView?.id === viewId) {
        setSelectedView(null);
      }
      setViewToDelete(null);
    } catch (error) {
      console.error('Error deleting view:', error);
      alert('Failed to delete view. Please try again.');
      setViewToDelete(null);
    }
  }, [selectedView]);

  const handleEditView = useCallback((view: ScheduleViewData) => {
    setEditingView(view);
    setNewViewName(view.name);
    setCurrentViewColumns(view.visibleColumns);
    setShowViewModal(true);
  }, []);

  const handleAssignViewToPack = useCallback(async (viewId: string, packId: string | null) => {
    try {
      await updateScheduleView(viewId, { packId: packId || undefined });
      setScheduleViews(prev => prev.map(v => 
        v.id === viewId ? { ...v, packId: packId || undefined } : v
      ));
    } catch (error) {
      console.error('Error assigning view to pack:', error);
      alert('Failed to assign view to package. Please try again.');
    }
  }, []);

  const getStatusBadge = (schedule: CSVUploadData) => {
    // Check for data arrays first (backward compatibility)
    const hasGroupedData = schedule.groupedData && schedule.groupedData.length > 0;
    const hasStandardizedData = schedule.standardizedData && schedule.standardizedData.length > 0;
    const hasExtractedData = schedule.extractedData && schedule.extractedData.length > 0;
    
    // Also check for URLs (new Storage-based approach)
    const hasGroupedDataUrl = schedule.groupedDataUrl;
    const hasStandardizedDataUrl = schedule.standardizedDataUrl;
    const hasExtractedDataUrl = schedule.extractedDataUrl;
    
    if (hasGroupedData || hasGroupedDataUrl) {
      return {
        label: 'Grouped',
        icon: <CheckCircleIcon width={14} height={14} />,
        color: 'var(--success)',
        bgColor: 'rgba(34, 197, 94, 0.1)'
      };
    } else if (hasStandardizedData || hasStandardizedDataUrl) {
      return {
        label: 'Standardised',
        icon: <ClockIcon width={14} height={14} />,
        color: 'var(--accent-primary)',
        bgColor: 'rgba(59, 130, 246, 0.1)'
      };
    } else if (hasExtractedData || hasExtractedDataUrl) {
      return {
        label: 'Extracted',
        icon: <ClockIcon width={14} height={14} />,
        color: 'var(--text-secondary)',
        bgColor: 'rgba(148, 163, 184, 0.1)'
      };
    } else {
      return {
        label: 'Uploaded',
        icon: <AlertCircleIcon width={14} height={14} />,
        color: 'var(--text-tertiary)',
        bgColor: 'rgba(148, 163, 184, 0.05)'
      };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRowCount = (schedule: CSVUploadData) => {
    // Check for data arrays first (backward compatibility)
    if (schedule.groupedData && schedule.groupedData.length > 0) {
      return schedule.groupedData.reduce((sum, group) => sum + (group.elements?.length || 0), 0);
    } else if (schedule.standardizedData && schedule.standardizedData.length > 0) {
      return schedule.standardizedData.length;
    } else if (schedule.extractedData && schedule.extractedData.length > 0) {
      return schedule.extractedData.length;
    }
    
    // If no data arrays but URLs exist, we can't count without loading
    // Return 0 for now - the data should be loaded by loadSchedules
    return 0;
  };

  // Convert grouped data back to flat array for editing
  const convertGroupedDataToFlat = (groupedData: NRMGroup[]): NRMElementData[] => {
    return groupedData.flatMap(group => 
      group.elements?.map(el => el.originalRowData) || []
    );
  };

  // Get the most processed data available for editing
  const getEditableData = (schedule: CSVUploadData): NRMElementData[] => {
    // Priority: standardizedData > extractedData
    // If groupedData exists, we'll convert it but prefer standardizedData if available
    if (schedule.standardizedData && schedule.standardizedData.length > 0) {
      return schedule.standardizedData;
    }
    if (schedule.groupedData && schedule.groupedData.length > 0) {
      return convertGroupedDataToFlat(schedule.groupedData);
    }
    return schedule.extractedData || [];
  };

  // Get preview data (first few rows and column names)
  const getPreviewData = (schedule: CSVUploadData) => {
    const editableData = getEditableData(schedule);
    if (editableData.length === 0) return { headers: [], rows: [] };
    
    const headers = Object.keys(editableData[0] || {});
    const previewRows = editableData.slice(0, 3); // Show first 3 rows
    
    return { headers: headers.slice(0, 5), rows: previewRows }; // Show first 5 columns
  };

  // Handle opening edit modal
  const handleEditSchedule = (schedule: CSVUploadData, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent triggering the view schedule action
    }
    setEditingSchedule(schedule);
    setEditForm({
      customName: schedule.customName || '',
      description: schedule.description || '',
      icon: schedule.icon || '📄',
      color: schedule.color || '#3b82f6',
      tags: schedule.tags || []
    });
  };

  // Handle saving schedule metadata
  const handleSaveMetadata = async () => {
    if (!editingSchedule) return;

    try {
      const updates: Partial<CSVUploadData> = {
        customName: editForm.customName || undefined,
        description: editForm.description || undefined,
        icon: editForm.icon || undefined,
        color: editForm.color || undefined,
        tags: editForm.tags.length > 0 ? editForm.tags : undefined
      };

      await updateCSVUpload(editingSchedule.id, updates);
      
      // Update local state
      setSchedules(prev => prev.map(s => 
        s.id === editingSchedule.id 
          ? { ...s, ...updates }
          : s
      ));
      
      if (selectedSchedule?.id === editingSchedule.id) {
        setSelectedSchedule(prev => prev ? { ...prev, ...updates } : null);
      }
      
      setEditingSchedule(null);
      alert('Schedule metadata saved successfully!');
    } catch (error) {
      console.error('Error saving schedule metadata:', error);
      alert('Failed to save schedule metadata. Please try again.');
    }
  };

  // Available icons for selection
  const availableIcons = ['📄', '📊', '📋', '📈', '📉', '📑', '📝', '📌', '🔖', '⭐', '💼', '🏗️', '📐', '🔧', '⚙️', '📦'];
  const availableColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  // Handle saving edited data
  const handleSaveData = useCallback(async (editedData: NRMElementData[]) => {
    if (!selectedSchedule) return;

    try {
      const updates: Partial<CSVUploadData> = {};
      
      // Determine which data field to update and upload to Storage
      if (selectedSchedule.standardizedDataUrl || (selectedSchedule.standardizedData && selectedSchedule.standardizedData.length > 0)) {
        // Upload standardizedData to Storage
        const standardizedDataUrl = await uploadProcessedData(
          userId,
          selectedSchedule.projectId,
          selectedSchedule.id,
          'standardized',
          editedData
        );
        updates.standardizedDataUrl = standardizedDataUrl;
      } else if (selectedSchedule.groupedDataUrl || (selectedSchedule.groupedData && selectedSchedule.groupedData.length > 0)) {
        // If it was grouped data, update standardizedData
        const standardizedDataUrl = await uploadProcessedData(
          userId,
          selectedSchedule.projectId,
          selectedSchedule.id,
          'standardized',
          editedData
        );
        updates.standardizedDataUrl = standardizedDataUrl;
      } else {
        // Update extractedData
        const extractedDataUrl = await uploadProcessedData(
          userId,
          selectedSchedule.projectId,
          selectedSchedule.id,
          'extracted',
          editedData
        );
        updates.extractedDataUrl = extractedDataUrl;
      }

      await updateCSVUpload(selectedSchedule.id, updates);
      
      // Update local state
      setSchedules(prev => prev.map(s => 
        s.id === selectedSchedule.id 
          ? { ...s, ...updates }
          : s
      ));
      setSelectedSchedule(prev => prev ? { ...prev, ...updates } : null);
      
      alert('Schedule data saved successfully!');
    } catch (error) {
      console.error('Error saving schedule data:', error);
      alert('Failed to save schedule data. Please try again.');
    }
  }, [selectedSchedule]);

  // Pack management functions
  const handleCreatePack = useCallback(async () => {
    if (!newPackName.trim()) return;
    
    try {
      const packId = await savePack(userId, projectId, {
        name: newPackName.trim(),
        type: 'schedules'
      });
      
      const newPack: PackData = {
        id: packId,
        projectId,
        userId,
        name: newPackName.trim(),
        type: 'schedules',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setPacks(prev => [...prev, newPack]);
      setNewPackName('');
      setShowPackModal(false);
    } catch (error) {
      console.error('Error creating pack:', error);
      alert('Failed to create pack. Please try again.');
    }
  }, [userId, projectId, newPackName]);

  const handleUpdatePack = useCallback(async (packId: string, name: string) => {
    try {
      await updatePack(packId, { name });
      setPacks(prev => prev.map(p => p.id === packId ? { ...p, name } : p));
    } catch (error) {
      console.error('Error updating pack:', error);
    }
  }, []);

  const handleDeletePack = useCallback(async (packId: string) => {
    if (!confirm('Are you sure you want to delete this package? Schedules will remain but package assignments will be removed.')) {
      return;
    }
    
    try {
      await deletePack(packId);
      setPacks(prev => prev.filter(p => p.id !== packId));
    } catch (error) {
      console.error('Error deleting pack:', error);
    }
  }, []);

  // Filter packs based on search query
  const filteredPacks = useMemo(() => {
    return packs; // For now, no search filtering for packs
  }, [packs]);

  // Get schedules for a specific pack (for future use when schedules have packIds)
  const getSchedulesForPack = useCallback((packId: string) => {
    // TODO: When schedules have packIds field, filter by packId
    return schedules.filter(s => false); // Placeholder
  }, [schedules]);

  // State for viewing grouped overview
  const [viewGroupedOverview, setViewGroupedOverview] = useState(false);
  const [isAllSchedulesExpanded, setIsAllSchedulesExpanded] = useState<boolean>(false);

  // If a schedule is selected and user wants to view grouped overview
  if (selectedSchedule && viewGroupedOverview && selectedSchedule.groupedData && selectedSchedule.groupedData.length > 0) {
    return (
      <OverviewLanding
        groupedData={selectedSchedule.groupedData as NRMGroup[]}
        fileName={selectedSchedule.fileName}
        onReset={() => setViewGroupedOverview(false)}
        onBack={() => {
          setViewGroupedOverview(false);
          setSelectedSchedule(null);
        }}
        userId={userId}
        projectId={projectId}
        scheduleId={selectedSchedule.id}
        packs={packs}
        onSaveView={async (viewName, packId) => {
          if (!selectedSchedule || !userId || !projectId) return;
          try {
            // Create a view for the grouped overview
            // Note: This is a simplified view - you may want to store more state
            await saveScheduleView(userId, projectId, selectedSchedule.id, {
              name: viewName,
              visibleColumns: [],
              groupByColumn: null,
              expandedGroups: [],
              showAllRows: true,
              showAllColumns: true,
              packId: packId || undefined
            });
            alert('View saved successfully!');
            // Reload views
            await loadScheduleViews(selectedSchedule.id);
          } catch (error) {
            console.error('Error saving view:', error);
            alert('Failed to save view. Please try again.');
          }
        }}
        onExportCSV={(data) => {
          const rows: string[][] = [];
          const headers = data.length > 0 ? Object.keys(data[0]) : [];
          rows.push(headers);
          data.forEach(element => {
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
          link.setAttribute('download', `${selectedSchedule.fileName.replace(/\.csv$/i, '')}_grouped_export.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
      />
    );
  }

  // If a schedule is selected, show the editable DataTable view
  if (selectedSchedule) {
    const editableData = getEditableData(selectedSchedule);
    const dataType = selectedSchedule.standardizedData && selectedSchedule.standardizedData.length > 0
      ? 'Standardised'
      : selectedSchedule.groupedData && selectedSchedule.groupedData.length > 0
      ? 'Grouped'
      : 'Extracted';

    return (
      <div className="landing-stack">
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedSchedule.groupedData && selectedSchedule.groupedData.length > 0 && (
              <button
                type="button"
                onClick={() => setViewGroupedOverview(true)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                View Grouped Overview
              </button>
            )}
            {/* Views dropdown */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select
                value={selectedView?.id || ''}
                onChange={(e) => {
                  const view = scheduleViews.find(v => v.id === e.target.value);
                  setSelectedView(view || null);
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="">Select a view...</option>
                {scheduleViews.map(view => (
                  <option key={view.id} value={view.id}>{view.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (getViewStateFn && typeof getViewStateFn === 'function') {
                  try {
                    const state = getViewStateFn();
                    setCurrentViewState(state);
                    setEditingView(null);
                    setNewViewName('');
                    setNewViewPackId(null);
                    setShowViewModal(true);
                  } catch (error) {
                    console.error('Error getting view state:', error);
                    alert('Failed to capture current view state. Please try again.');
                  }
                } else {
                  alert('View state function not available. Please wait a moment and try again.');
                }
              }}
              className="btn btn-secondary"
              style={{ padding: '8px 16px' }}
              disabled={!getViewStateFn}
            >
              <PlusIcon width={16} height={16} style={{ marginRight: '6px' }} />
              Save Current View
            </button>
            {selectedView && (
              <button
                type="button"
                onClick={() => setViewToDelete(selectedView)}
                className="btn btn-ghost"
                style={{ padding: '8px', color: 'var(--danger)', minWidth: '36px' }}
                title="Delete selected view"
              >
                <XIcon width={18} height={18} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleBackToList}
            className="btn btn-ghost"
            style={{ padding: '8px 16px' }}
          >
            ← Back to Schedules
          </button>
        </div>

        <DataTable
          title={`Schedule: ${selectedSchedule.fileName}`}
          description={`Editing ${dataType.toLowerCase()} CSV data (${editableData.length.toLocaleString()} rows). Make changes and click "Save Changes" to update.`}
          data={editableData}
          onNext={handleSaveData}
          onBack={handleBackToList}
          onReset={handleBackToList}
          showStandardizeFunctionality={true}
          nextButtonText="Save Changes"
          scheduleId={selectedSchedule.id}
          selectedView={selectedView}
          onViewColumnsChange={setCurrentViewColumns}
          onGetViewState={(fn) => setGetViewStateFn(() => fn)}
          packs={packs}
          onAssignViewToPack={handleAssignViewToPack}
          onViewCleared={() => setSelectedView(null)}
          onAddToPackage={async (selectedRows, packId) => {
            if (!selectedSchedule || !userId || !projectId || selectedRows.length === 0) return;
            
            try {
              // Get the current view state to preserve column visibility
              const currentViewState = getViewStateFn ? getViewStateFn() : {
                visibleColumns: Array.from(new Set(Object.keys(selectedRows[0] || {}))),
                groupByColumn: null,
                expandedGroups: [],
                showAllRows: true,
                showAllColumns: true
              };
              
              // Create a view that represents this package selection
              const packName = packs.find(p => p.id === packId)?.name || 'Unnamed Package';
              const viewName = `${packName} (${selectedRows.length} items)`;
              
              const viewId = await saveScheduleView(userId, projectId, selectedSchedule.id, {
                name: viewName,
                visibleColumns: currentViewState.visibleColumns,
                groupByColumn: currentViewState.groupByColumn,
                expandedGroups: currentViewState.expandedGroups,
                showAllRows: currentViewState.showAllRows,
                showAllColumns: currentViewState.showAllColumns,
                packId: packId || undefined
              });
              
              // Reload views to show the new one
              await loadScheduleViews(selectedSchedule.id);
              
              alert(`Successfully added ${selectedRows.length} rows to package "${packName}"!`);
            } catch (error) {
              console.error('Error adding rows to package:', error);
              alert('Failed to add rows to package. Please try again.');
            }
          }}
          onExportCSV={(data) => {
            const rows: string[][] = [];
            const headers = data.length > 0 ? Object.keys(data[0]) : [];
            rows.push(headers);
            data.forEach(element => {
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
            link.setAttribute('download', `${selectedSchedule.fileName.replace(/\.csv$/i, '')}_export.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
        />
        
        {/* View Modal */}
        {showViewModal && (
          <ViewModal
            viewName={newViewName}
            onViewNameChange={setNewViewName}
            onSave={(name, packId) => {
              if (currentViewState) {
                handleSaveView(name, currentViewState, packId);
              }
            }}
            onClose={() => {
              setShowViewModal(false);
              setEditingView(null);
              setNewViewName('');
              setCurrentViewColumns([]);
              setNewViewPackId(null);
            }}
            editingView={editingView}
            packs={packs}
            selectedPackId={editingView?.packId || newViewPackId || undefined}
            onPackChange={setNewViewPackId}
          />
        )}
        
        {/* Delete View Confirmation Modal */}
        {viewToDelete && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }} onClick={() => setViewToDelete(null)}>
            <div 
              className="card" 
              style={{ 
                width: '90%', 
                maxWidth: '400px',
                padding: '24px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
                Delete View
              </h3>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)' }}>
                Are you sure you want to delete the view "{viewToDelete.name}"? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setViewToDelete(null)}
                  style={{ fontSize: '14px', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleDeleteView(viewToDelete.id)}
                  style={{ fontSize: '14px', padding: '8px 16px', backgroundColor: 'var(--danger)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="landing-stack">
      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title" style={{ 
              fontFamily: 'var(--font-body)',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--accent-primary)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              textShadow: 'none',
              WebkitFontSmoothing: 'subpixel-antialiased',
              MozOsxFontSmoothing: 'auto'
            }}>
              Schedule Management
            </h2>
            <p className="panel__subtitle">
              Manage and view your uploaded CSV schedules
            </p>
          </div>
        </header>

        {isLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading schedules...
          </div>
        ) : error ? (
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            borderRadius: '8px',
            color: 'var(--danger)'
          }}>
            {error}
          </div>
        ) : schedules.length === 0 ? (
          <div style={{ 
            padding: '80px 40px', 
            textAlign: 'center',
            border: '2px dashed var(--border-strong)',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-surface-muted)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '12px',
              background: 'var(--accent-soft)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              color: 'var(--accent-primary)'
            }}>
              <TableIcon width={32} height={32} />
            </div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
              No schedules yet
            </h3>
            <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              Upload CSV files to start managing your schedules. They will appear here after processing.
            </p>
          </div>
        ) : (
          <>
            {/* All Schedules Section */}
            <div style={{ marginBottom: '40px', maxWidth: '100%', overflow: 'hidden' }}>
              <div
                onClick={() => setIsAllSchedulesExpanded(!isAllSchedulesExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '16px 0',
                  cursor: 'pointer',
                  marginBottom: '20px'
                }}
              >
                {isAllSchedulesExpanded ? (
                  <ChevronDownIcon width={20} height={20} style={{ color: 'var(--accent-primary)' }} />
                ) : (
                  <ChevronRightIcon width={20} height={20} style={{ color: 'var(--accent-primary)' }} />
                )}
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '24px', 
                  fontWeight: 700,
                  color: 'var(--accent-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: 'var(--font-body)',
                  textShadow: 'none',
                  WebkitFontSmoothing: 'subpixel-antialiased',
                  MozOsxFontSmoothing: 'auto'
                }}>
                  All Schedules
                </h3>
                <span style={{ 
                  marginLeft: 'auto',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  ({schedules.length})
                </span>
              </div>
              {isAllSchedulesExpanded && (
                <div style={{ display: 'grid', gap: '16px', maxWidth: '100%', overflow: 'hidden' }}>
                  {schedules.map((schedule) => {
                    const status = getStatusBadge(schedule);
                    const rowCount = getRowCount(schedule);
                    const preview = getPreviewData(schedule);
                    const displayName = schedule.customName || schedule.fileName;
                    const scheduleColor = schedule.color || '#3b82f6';
                    const scheduleIcon = schedule.icon ? (
                      <span style={{ fontSize: '28px' }}>{schedule.icon}</span>
                    ) : (
                      <FileIcon width={28} height={28} style={{ color: scheduleColor }} />
                    );
                    
                    return (
                  <div
                    key={schedule.id}
                    className="card"
                    style={{
                      padding: '20px',
                      transition: 'all 0.2s ease',
                      borderLeft: `4px solid ${scheduleColor}`,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      boxSizing: 'border-box'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            backgroundColor: `${scheduleColor}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            border: `2px solid ${scheduleColor}30`
                          }}>
                            {scheduleIcon}
                          </div>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: status.bgColor,
                            color: status.color,
                            border: `1px solid ${status.color}20`,
                            whiteSpace: 'nowrap'
                          }}>
                            {status.icon}
                            {status.label}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                            <h3 style={{ 
                              margin: 0, 
                              fontSize: '18px', 
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: '1 1 auto',
                              minWidth: 0
                            }}>
                              {displayName}
                            </h3>
                            {schedule.customName && (
                              <span style={{
                                fontSize: '12px',
                                color: 'var(--text-tertiary)',
                                fontStyle: 'italic'
                              }}>
                                {schedule.fileName}
                              </span>
                            )}
                          </div>
                          {schedule.description && (
                            <p style={{ 
                              margin: '0 0 8px 0', 
                              fontSize: '14px', 
                              color: 'var(--text-secondary)',
                              lineHeight: '1.4'
                            }}>
                              {schedule.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <TableIcon width={14} height={14} />
                              {rowCount.toLocaleString()} rows
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CalendarIcon width={14} height={14} />
                              {formatDate(schedule.updatedAt)}
                            </span>
                            {schedule.tags && schedule.tags.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {schedule.tags.slice(0, 3).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      backgroundColor: `${scheduleColor}20`,
                                      color: scheduleColor,
                                      fontWeight: 500
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {schedule.tags.length > 3 && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                    +{schedule.tags.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {(schedule.groupedData || schedule.standardizedData || schedule.extractedData || 
                          schedule.groupedDataUrl || schedule.standardizedDataUrl || schedule.extractedDataUrl) && (
                          <button
                            type="button"
                            onClick={() => handleViewSchedule(schedule)}
                            className="btn btn-primary"
                            style={{ padding: '8px 16px' }}
                          >
                            <EyeIcon width={16} height={16} style={{ marginRight: '6px' }} />
                            View Data
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleEditSchedule(schedule, e)}
                          className="btn btn-ghost"
                          style={{ 
                            padding: '8px',
                            color: 'var(--text-secondary)',
                            minWidth: '36px'
                          }}
                          title="Edit schedule"
                        >
                          <EditIcon width={18} height={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(schedule.id)}
                          className="btn btn-ghost"
                          style={{ 
                            padding: '8px',
                            color: 'var(--danger)',
                            minWidth: '36px'
                          }}
                          title="Delete schedule"
                        >
                          <TrashIcon width={18} height={18} />
                        </button>
                      </div>
                    </div>

                    {/* Data Preview */}
                    {preview.headers.length > 0 && (
                      <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: 'var(--bg-surface-muted)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        maxWidth: '100%',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: 600, 
                          color: 'var(--text-secondary)', 
                          marginBottom: '8px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Data Preview
                        </div>
                        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                {preview.headers.map((header, idx) => (
                                  <th
                                    key={idx}
                                    style={{
                                      padding: '6px 8px',
                                      textAlign: 'left',
                                      fontWeight: 600,
                                      color: 'var(--text-secondary)',
                                      borderBottom: '1px solid var(--border-subtle)',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {preview.rows.map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                  {preview.headers.map((header, colIdx) => {
                                    const cellValue = (row as Record<string, string>)[header] || '';
                                    return (
                                      <td
                                        key={colIdx}
                                        style={{
                                          padding: '6px 8px',
                                          color: 'var(--text-primary)',
                                          borderBottom: '1px solid var(--border-subtle)',
                                          maxWidth: '150px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}
                                        title={cellValue}
                                      >
                                        {cellValue}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {rowCount > 3 && (
                          <div style={{ 
                            marginTop: '8px', 
                            fontSize: '11px', 
                            color: 'var(--text-tertiary)',
                            textAlign: 'right'
                          }}>
                            Showing first 3 rows of {rowCount.toLocaleString()} total
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Packages Section */}
            <div style={{ marginBottom: '40px' }}>
              <div
                onClick={() => setIsPackagesExpanded(!isPackagesExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '16px 0',
                  cursor: 'pointer',
                  marginBottom: '20px'
                }}
              >
                {isPackagesExpanded ? (
                  <ChevronDownIcon width={20} height={20} style={{ color: 'var(--accent-primary)' }} />
                ) : (
                  <ChevronRightIcon width={20} height={20} style={{ color: 'var(--accent-primary)' }} />
                )}
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '24px', 
                  fontWeight: 700,
                  color: 'var(--accent-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: 'var(--font-body)',
                  textShadow: 'none',
                  WebkitFontSmoothing: 'subpixel-antialiased',
                  MozOsxFontSmoothing: 'auto'
                }}>
                  Packages
                </h3>
                <span style={{ 
                  marginLeft: 'auto',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  ({filteredPacks.length})
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPack(null);
                    setNewPackName('');
                    setShowPackModal(true);
                  }}
                  style={{ fontSize: '14px', padding: '8px 16px', marginLeft: '12px' }}
                >
                  <PlusIcon width={16} height={16} style={{ marginRight: 8 }} />
                  Create Package
                </button>
              </div>

              {isPackagesExpanded && (
                <>
                  {filteredPacks.length === 0 ? (
                    <div style={{ 
                      padding: '60px 40px', 
                      textAlign: 'center',
                      border: '2px dashed var(--border-strong)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-surface-muted)'
                    }}>
                      <TableIcon width={48} height={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                      <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                        {packs.length === 0 ? 'No packages created' : 'No packages match your search'}
                      </h3>
                      <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>
                        {packs.length === 0 
                          ? 'Create packages to organize schedules for different contractors or purposes.'
                          : 'Try adjusting your search query.'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {filteredPacks.map(pack => (
                        <PackSection
                          key={pack.id}
                          pack={pack}
                          schedules={getSchedulesForPack(pack.id)}
                          views={scheduleViews}
                          selectedView={selectedView}
                          onSelectView={setSelectedView}
                          onEditView={handleEditView}
                          onDeleteView={(viewId) => {
                            const view = scheduleViews.find(v => v.id === viewId);
                            if (view) setViewToDelete(view);
                          }}
                          onUpdatePack={handleUpdatePack}
                          onDeletePack={handleDeletePack}
                          onViewClick={handleViewScheduleWithView}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Edit Modal */}
            {editingSchedule && (
              <div 
                className="modal"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000
                }}
                onClick={() => setEditingSchedule(null)}
              >
                <div 
                  className="floating-panel"
                  style={{
                    maxWidth: '600px',
                    width: '90%',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="floating-panel__header">
                    <h3 className="floating-panel__title">Edit Schedule</h3>
                    <button 
                      type="button" 
                      className="floating-panel__close" 
                      onClick={() => setEditingSchedule(null)}
                    >
                      <XIcon width={16} height={16} />
                    </button>
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label className="section-title" htmlFor="custom-name">Custom Name</label>
                      <input
                        id="custom-name"
                        className="input"
                        type="text"
                        value={editForm.customName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, customName: e.target.value }))}
                        placeholder={editingSchedule.fileName}
                      />
                      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        Leave empty to use filename: {editingSchedule.fileName}
                      </p>
                    </div>

                    <div>
                      <label className="section-title" htmlFor="description">Description</label>
                      <textarea
                        id="description"
                        className="input"
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Add a description for this schedule..."
                        rows={3}
                        style={{ resize: 'vertical' }}
                      />
                    </div>

                    <div>
                      <label className="section-title">Icon</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px' }}>
                        {availableIcons.map(icon => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, icon }))}
                            style={{
                              width: '48px',
                              height: '48px',
                              border: `2px solid ${editForm.icon === icon ? editForm.color : 'var(--border-strong)'}`,
                              borderRadius: '8px',
                              backgroundColor: editForm.icon === icon ? `${editForm.color}15` : 'var(--bg-surface)',
                              fontSize: '24px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="section-title">Color</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {availableColors.map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, color }))}
                            style={{
                              width: '40px',
                              height: '40px',
                              border: `3px solid ${editForm.color === color ? 'var(--text-primary)' : 'transparent'}`,
                              borderRadius: '8px',
                              backgroundColor: color,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="section-title" htmlFor="tags">Tags (comma-separated)</label>
                      <input
                        id="tags"
                        className="input"
                        type="text"
                        value={editForm.tags.join(', ')}
                        onChange={(e) => {
                          const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                          setEditForm(prev => ({ ...prev, tags }));
                        }}
                        placeholder="e.g., Q1, Construction, Priority"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setEditingSchedule(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSaveMetadata}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Pack Modal */}
        {showPackModal && (
          <PackModal
            pack={editingPack}
            packName={newPackName}
            onPackNameChange={setNewPackName}
            onSave={editingPack 
              ? () => {
                  handleUpdatePack(editingPack.id, newPackName);
                  setShowPackModal(false);
                  setEditingPack(null);
                  setNewPackName('');
                }
              : handleCreatePack
            }
            onClose={() => {
              setShowPackModal(false);
              setEditingPack(null);
              setNewPackName('');
            }}
          />
        )}
      </section>
    </div>
  );
};

// Pack Section Component
interface PackSectionProps {
  pack: PackData;
  schedules: CSVUploadData[];
  views: ScheduleViewData[];
  selectedView: ScheduleViewData | null;
  onSelectView: (view: ScheduleViewData | null) => void;
  onEditView: (view: ScheduleViewData) => void;
  onDeleteView: (viewId: string) => void;
  onUpdatePack: (packId: string, name: string) => void;
  onDeletePack: (packId: string) => void;
  onViewClick: (view: ScheduleViewData) => void;
}

const PackSection: React.FC<PackSectionProps> = ({ 
  pack, 
  schedules,
  views,
  selectedView,
  onSelectView,
  onEditView,
  onDeleteView,
  onUpdatePack, 
  onDeletePack,
  onViewClick
}) => {
  const packViews = views.filter(v => v.packId === pack.id);
  const [isEditing, setIsEditing] = useState(false);
  const [packName, setPackName] = useState(pack.name);

  const handleSave = () => {
    onUpdatePack(pack.id, packName);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setPackName(pack.name);
    setIsEditing(false);
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {isEditing ? (
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <input
              type="text"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid var(--border-strong)',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 600,
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)'
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              style={{ fontSize: '14px', padding: '8px 12px' }}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              style={{ fontSize: '14px', padding: '8px 12px' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{pack.name}</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsEditing(true)}
                style={{ fontSize: '14px', padding: '8px' }}
              >
                <EditIcon width={16} height={16} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onDeletePack(pack.id)}
                style={{ fontSize: '14px', padding: '8px', color: 'var(--danger)' }}
              >
                <XIcon width={16} height={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Views for this pack */}
      {packViews.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Views
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {packViews.map(view => (
              <div
                key={view.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: selectedView?.id === view.id ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  color: selectedView?.id === view.id ? 'white' : 'var(--text-primary)',
                  borderRadius: '6px',
                  border: `1px solid ${selectedView?.id === view.id ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: selectedView?.id === view.id ? 600 : 500
                }}
                onClick={() => onViewClick(view)}
              >
                <span>{view.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditView(view);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: selectedView?.id === view.id ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Edit view"
                >
                  <EditIcon width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

// Pack Modal Component
interface PackModalProps {
  pack: PackData | null;
  packName: string;
  onPackNameChange: (name: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const PackModal: React.FC<PackModalProps> = ({ pack, packName, onPackNameChange, onSave, onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div 
        className="card" 
        style={{ 
          width: '90%', 
          maxWidth: '500px',
          padding: '24px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 600 }}>
          {pack ? 'Edit Package' : 'Create New Package'}
        </h3>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            Package Name
          </label>
          <input
            type="text"
            value={packName}
            onChange={(e) => onPackNameChange(e.target.value)}
            placeholder="e.g., Walls Package, Doors Package"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid var(--border-strong)',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)'
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ fontSize: '14px', padding: '8px 16px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={!packName.trim()}
            style={{ fontSize: '14px', padding: '8px 16px' }}
          >
            {pack ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

// View Modal Component
interface ViewModalProps {
  viewName: string;
  onViewNameChange: (name: string) => void;
  onSave: (name: string, packId?: string | null) => void;
  onClose: () => void;
  editingView: ScheduleViewData | null;
  packs: PackData[];
  selectedPackId?: string;
  onPackChange?: (packId: string | null) => void;
}

const ViewModal: React.FC<ViewModalProps> = ({ 
  viewName, 
  onViewNameChange, 
  onSave, 
  onClose, 
  editingView,
  packs,
  selectedPackId,
  onPackChange
}) => {
  const [localPackId, setLocalPackId] = useState<string | null>(selectedPackId || null);

  useEffect(() => {
    setLocalPackId(selectedPackId || null);
  }, [selectedPackId]);
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div 
        className="card" 
        style={{ 
          width: '90%', 
          maxWidth: '500px',
          padding: '24px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 600 }}>
          {editingView ? 'Edit View' : 'Save Current View'}
        </h3>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            View Name
          </label>
          <input
            type="text"
            value={viewName}
            onChange={(e) => onViewNameChange(e.target.value)}
            placeholder="e.g., Main View, Filtered View"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid var(--border-strong)',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)'
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && viewName.trim()) {
                onSave(viewName, localPackId);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
        </div>
        {packs.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Assign to Schedule Package (Optional)
            </label>
            <select
              value={localPackId || ''}
              onChange={(e) => {
                const packId = e.target.value || null;
                setLocalPackId(packId);
                if (onPackChange) {
                  onPackChange(packId);
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid var(--border-strong)',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="">No package</option>
              {packs.map(pack => (
                <option key={pack.id} value={pack.id}>{pack.name}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ fontSize: '14px', padding: '8px 16px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave(viewName, localPackId)}
            disabled={!viewName.trim()}
            style={{ fontSize: '14px', padding: '8px 16px' }}
          >
            {editingView ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

