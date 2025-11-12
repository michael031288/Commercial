import React, { useState, useEffect, useCallback } from 'react';
import { CSVUploadData, getProjectCSVUploads, deleteCSVUpload, updateCSVUpload } from '../services/firestoreService';
import { TableIcon, FileIcon, TrashIcon, EyeIcon, CalendarIcon, CheckCircleIcon, ClockIcon, AlertCircleIcon, EditIcon, XIcon } from './Icons';
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

  const loadSchedules = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const uploads = await getProjectCSVUploads(userId, projectId);
      setSchedules(uploads);
    } catch (err) {
      console.error('Error loading schedules:', err);
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

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

  const handleViewSchedule = (schedule: CSVUploadData) => {
    setSelectedSchedule(schedule);
    setViewGroupedOverview(false); // Reset grouped overview view when selecting a schedule
  };

  const handleBackToList = () => {
    setSelectedSchedule(null);
  };

  const getStatusBadge = (schedule: CSVUploadData) => {
    if (schedule.groupedData && schedule.groupedData.length > 0) {
      return {
        label: 'Grouped',
        icon: <CheckCircleIcon width={14} height={14} />,
        color: 'var(--success)',
        bgColor: 'rgba(34, 197, 94, 0.1)'
      };
    } else if (schedule.standardizedData && schedule.standardizedData.length > 0) {
      return {
        label: 'Standardized',
        icon: <ClockIcon width={14} height={14} />,
        color: 'var(--accent-primary)',
        bgColor: 'rgba(59, 130, 246, 0.1)'
      };
    } else if (schedule.extractedData && schedule.extractedData.length > 0) {
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
    if (schedule.groupedData) {
      return schedule.groupedData.reduce((sum, group) => sum + (group.elements?.length || 0), 0);
    } else if (schedule.standardizedData) {
      return schedule.standardizedData.length;
    } else if (schedule.extractedData) {
      return schedule.extractedData.length;
    }
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
      // Determine which data field to update based on what was originally shown
      const updates: Partial<CSVUploadData> = {};
      
      if (selectedSchedule.standardizedData && selectedSchedule.standardizedData.length > 0) {
        // Update standardizedData
        updates.standardizedData = editedData;
      } else if (selectedSchedule.groupedData && selectedSchedule.groupedData.length > 0) {
        // If it was grouped data, we need to preserve the grouping structure
        // For now, update standardizedData (which should exist if groupedData exists)
        // If not, update extractedData
        if (selectedSchedule.standardizedData) {
          updates.standardizedData = editedData;
        } else {
          updates.extractedData = editedData;
        }
      } else {
        // Update extractedData
        updates.extractedData = editedData;
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

  // State for viewing grouped overview
  const [viewGroupedOverview, setViewGroupedOverview] = useState(false);

  // If a schedule is selected and user wants to view grouped overview
  if (selectedSchedule && viewGroupedOverview && selectedSchedule.groupedData && selectedSchedule.groupedData.length > 0) {
    return (
      <OverviewLanding
        groupedData={selectedSchedule.groupedData as NRMGroup[]}
        fileName={selectedSchedule.fileName}
        onReset={() => setViewGroupedOverview(false)}
      />
    );
  }

  // If a schedule is selected, show the editable DataTable view
  if (selectedSchedule) {
    const editableData = getEditableData(selectedSchedule);
    const dataType = selectedSchedule.standardizedData && selectedSchedule.standardizedData.length > 0
      ? 'Standardized'
      : selectedSchedule.groupedData && selectedSchedule.groupedData.length > 0
      ? 'Grouped'
      : 'Extracted';

    return (
      <div className="landing-stack">
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
        />
      </div>
    );
  }

  return (
    <div className="landing-stack">
      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title">Schedule Management</h2>
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
            <div style={{ display: 'grid', gap: '16px' }}>
              {schedules.map((schedule) => {
                const status = getStatusBadge(schedule);
                const rowCount = getRowCount(schedule);
                const preview = getPreviewData(schedule);
                const displayName = schedule.customName || schedule.fileName;
                const scheduleColor = schedule.color || '#3b82f6';
                const scheduleIcon = schedule.icon || '📄';
                
                return (
                  <div
                    key={schedule.id}
                    className="card"
                    style={{
                      padding: '20px',
                      transition: 'all 0.2s ease',
                      borderLeft: `4px solid ${scheduleColor}`
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '12px',
                          backgroundColor: `${scheduleColor}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '28px',
                          flexShrink: 0,
                          border: `2px solid ${scheduleColor}30`
                        }}>
                          {scheduleIcon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <h3 style={{ 
                              margin: 0, 
                              fontSize: '18px', 
                              fontWeight: 600,
                              color: 'var(--text-primary)'
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
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 500,
                              backgroundColor: status.bgColor,
                              color: status.color,
                              border: `1px solid ${status.color}20`
                            }}>
                              {status.icon}
                              {status.label}
                            </span>
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
                        <button
                          type="button"
                          onClick={(e) => handleEditSchedule(schedule, e)}
                          className="btn btn-ghost"
                          style={{ 
                            padding: '8px',
                            color: 'var(--text-secondary)'
                          }}
                          title="Edit schedule"
                        >
                          <EditIcon width={18} height={18} />
                        </button>
                        {(schedule.groupedData || schedule.standardizedData || schedule.extractedData) && (
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
                          onClick={() => handleDelete(schedule.id)}
                          className="btn btn-ghost"
                          style={{ 
                            padding: '8px',
                            color: 'var(--danger)'
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
                        border: '1px solid var(--border-subtle)'
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
                        <div style={{ overflowX: 'auto' }}>
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
      </section>
    </div>
  );
};

