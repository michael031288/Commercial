import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CubeIcon, PlusIcon, TrashIcon, EyeIcon, XIcon, CalendarIcon, CheckCircleIcon, AlertCircleIcon, ChevronDownIcon, ChevronRightIcon } from './Icons';
import { IFCModelData, getProjectIFCModels, deleteIFCModel, saveIFCModel, updateIFCModel } from '../services/firestoreService';
import { uploadIFC, uploadFragments, getIFCBlob } from '../services/storageService';
import { getProjectCSVUploads, CSVUploadData } from '../services/firestoreService';
import { detectGUIDColumn } from '../utils/guidDetection';
import { IFCViewer } from './IFCViewer';
import { IFCModelViewer } from './IFCModelViewer';
import * as OBC from '@thatopen/components';

interface IFCModelsLandingProps {
  userId: string;
  projectId: string;
}

export const IFCModelsLanding: React.FC<IFCModelsLandingProps> = ({ userId, projectId }) => {
  const [models, setModels] = useState<IFCModelData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<IFCModelData | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'viewer'>('list');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [linkToSchedule, setLinkToSchedule] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [schedules, setSchedules] = useState<CSVUploadData[]>([]);
  const [availableProperties, setAvailableProperties] = useState<string[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAllModelsExpanded, setIsAllModelsExpanded] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadModels = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const loadedModels = await getProjectIFCModels(userId, projectId);
      setModels(loadedModels);
    } catch (err) {
      console.error('Error loading IFC models:', err);
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId]);

  const loadSchedules = useCallback(async () => {
    if (!projectId) return;
    try {
      const loadedSchedules = await getProjectCSVUploads(userId, projectId);
      setSchedules(loadedSchedules);
    } catch (err) {
      console.error('Error loading schedules:', err);
    }
  }, [userId, projectId]);

  useEffect(() => {
    loadModels();
    loadSchedules();
  }, [loadModels, loadSchedules]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('File selected:', file?.name, file?.type);
    if (file) {
      // Accept both .ifc and .frag files
      const fileName = file.name.toLowerCase();
      const isValidFile = fileName.endsWith('.ifc') || 
                         fileName.endsWith('.frag') ||
                         file.type === 'application/octet-stream' ||
                         file.type === '';
      if (isValidFile) {
        console.log('Valid file, showing modal');
        setUploadFile(file);
        setShowUploadModal(true);
        setError(null);
      } else {
        console.log('Invalid file type:', file.type);
        setError('Please select a valid .ifc or .frag file');
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const extractIFCProperties = async (file: File): Promise<string[]> => {
    try {
      // Create a temporary URL for the file
      const fileUrl = URL.createObjectURL(file);
      
      // Return common IFC properties without loading the file
      // Full property extraction will happen when viewing the model
      const commonProps = ['GlobalId', 'Tag', 'Name', 'ObjectType', 'Description', 'LongName', 'PredefinedType'];
      
      // Cleanup
      URL.revokeObjectURL(fileUrl);

      return commonProps;
    } catch (err) {
      console.error('Error extracting IFC properties:', err);
      return ['GlobalId', 'Tag', 'Name']; // Fallback to common properties
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !projectId) return;

    setIsUploading(true);
    setUploadProgress('Uploading IFC file...');
    setError(null);

    try {
      // Check if file is already a fragments file
      const isFragmentsFile = uploadFile.name.toLowerCase().endsWith('.frag');
      
      let fileUrl: string;
      let fragmentsUrl: string | undefined;
      
      if (isFragmentsFile) {
        // Upload fragments file directly
        setUploadProgress('Uploading fragments file...');
        fragmentsUrl = await uploadFragments(userId, projectId, await uploadFile.arrayBuffer(), uploadFile.name);
        fileUrl = fragmentsUrl; // Use fragments URL as file URL
        setUploadProgress('Fragments file uploaded successfully');
      } else {
        // Upload IFC file - conversion to fragments will happen when viewing
        setUploadProgress('Uploading IFC file...');
        fileUrl = await uploadIFC(userId, projectId, uploadFile);
        setUploadProgress('IFC file uploaded successfully');
      }

      // Step 3: Extract properties if linking to schedule
      let modelProperty = selectedProperty;
      if (linkToSchedule && !selectedProperty) {
        setUploadProgress('Extracting properties...');
        const props = await extractIFCProperties(uploadFile);
        setAvailableProperties(props);
        modelProperty = props[0] || 'GlobalId';
      }

      // Step 4: Save model metadata
      setUploadProgress('Saving model...');
      const modelData: Omit<IFCModelData, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        projectId,
        fileName: uploadFile.name,
        fileUrl,
        // Only include fragmentsUrl if it exists
        ...(fragmentsUrl && { fragmentsUrl }),
        // Only include schedule linking fields if linking to schedule
        ...(linkToSchedule && {
          scheduleId: selectedScheduleId,
          scheduleColumn: selectedColumn,
          modelProperty: modelProperty,
        }),
      };

      await saveIFCModel(userId, projectId, modelData);

      // Reload models
      await loadModels();

      // Reset form
      setShowUploadModal(false);
      setUploadFile(null);
      setLinkToSchedule(false);
      setSelectedScheduleId('');
      setSelectedColumn('');
      setSelectedProperty('');
      setAvailableProperties([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading IFC:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload IFC file');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this IFC model? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteIFCModel(modelId);
      setModels(prev => prev.filter(m => m.id !== modelId));
      if (selectedModel?.id === modelId) {
        setSelectedModel(null);
        setViewMode('list');
      }
    } catch (err) {
      console.error('Error deleting model:', err);
      alert('Failed to delete model. Please try again.');
    }
  };

  const handleViewModel = (model: IFCModelData) => {
    setSelectedModel(model);
    setViewMode('viewer');
  };

  const handleBackToList = () => {
    setSelectedModel(null);
    setViewMode('list');
  };

  const handleScheduleSelect = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    const schedule = schedules.find(s => s.id === scheduleId);
    if (schedule) {
      // Get editable data
      const editableData = schedule.standardizedData || schedule.extractedData || [];
      if (editableData.length > 0) {
        // Extract available columns
        const columns = Object.keys(editableData[0] || {});
        setAvailableColumns(columns);
        
        // Auto-detect GUID column
        const detectedColumn = detectGUIDColumn(editableData);
        setSelectedColumn(detectedColumn || columns[0] || '');
      } else {
        setAvailableColumns([]);
        setSelectedColumn('');
      }
    } else {
      setAvailableColumns([]);
      setSelectedColumn('');
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

  // If viewing a model, show the viewer
  if (viewMode === 'viewer' && selectedModel) {
    if (selectedModel.scheduleId) {
      // Show combined schedule/model viewer
      return (
        <IFCModelViewer
          model={selectedModel}
          userId={userId}
          projectId={projectId}
          onBack={handleBackToList}
        />
      );
    } else {
      // Show just the model viewer
      return (
        <div className="landing-stack">
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="panel__title">{selectedModel.fileName}</h2>
            <button
              type="button"
              onClick={handleBackToList}
              className="btn btn-ghost"
            >
              ← Back to Models
            </button>
          </div>
          <div style={{ width: '100%', height: '600px', border: '1px solid var(--border-strong)', borderRadius: '8px', overflow: 'hidden' }}>
            <IFCViewer fragmentsUrl={selectedModel.fragmentsUrl} ifcUrl={selectedModel.fileUrl} />
          </div>
        </div>
      );
    }
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
              IFC Models
            </h2>
            <p className="panel__subtitle">
              Upload and manage IFC files, link them to schedules for bidirectional navigation
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary"
            disabled={isUploading}
          >
            <PlusIcon width={16} height={16} style={{ marginRight: '8px' }} />
            Upload IFC
          </button>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept=".ifc,.frag,application/octet-stream"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: 'var(--danger)',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading models...
          </div>
        ) : models.length === 0 ? (
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
              <CubeIcon width={32} height={32} />
            </div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
              No IFC models yet
            </h3>
            <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              Upload IFC files to start viewing and linking them to your schedules.
            </p>
          </div>
        ) : (
          <>
            {/* All Models Section */}
            <div style={{ marginBottom: '40px' }}>
              <div
                onClick={() => setIsAllModelsExpanded(!isAllModelsExpanded)}
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
                {isAllModelsExpanded ? (
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
                  All Models
                </h3>
                <span style={{ 
                  marginLeft: 'auto',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  ({models.length})
                </span>
              </div>
              {isAllModelsExpanded && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className="card"
                      style={{
                        padding: '20px',
                        transition: 'all 0.2s ease',
                        borderLeft: '4px solid var(--accent-primary)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--accent-soft)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            flexShrink: 0
                          }}>
                            <CubeIcon width={32} height={32} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {model.fileName}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CalendarIcon width={14} height={14} />
                                {formatDate(model.updatedAt)}
                              </span>
                              {model.scheduleId && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                  color: 'var(--success)',
                                  border: '1px solid rgba(34, 197, 94, 0.3)'
                                }}>
                                  <CheckCircleIcon width={14} height={14} />
                                  Linked to Schedule
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleViewModel(model)}
                            className="btn btn-primary"
                            style={{ padding: '8px 16px' }}
                          >
                            <EyeIcon width={16} height={16} style={{ marginRight: '6px' }} />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(model.id)}
                            className="btn btn-ghost"
                            style={{ padding: '8px', color: 'var(--danger)' }}
                            title="Delete model"
                          >
                            <TrashIcon width={18} height={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Upload Modal */}
      {showUploadModal && (
        <>
          {/* Overlay - only covers main content, not sidebar */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: '260px', // Start after sidebar width
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999
            }}
            onClick={() => {
              if (!isUploading) {
                setShowUploadModal(false);
                setUploadFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }
            }}
          />
          {/* Modal Content */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-soft)',
              zIndex: 10001,
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 20px 0 20px',
              borderBottom: '1px solid var(--border-soft)',
              marginBottom: '20px'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Upload IFC Model</h3>
              <button
                type="button"
                onClick={() => {
                  if (!isUploading) {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }
                }}
                disabled={isUploading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <XIcon width={20} height={20} />
              </button>
            </div>

            <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="section-title">File</label>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-muted)', borderRadius: '8px' }}>
                  {uploadFile?.name || 'No file selected'}
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={linkToSchedule}
                    onChange={(e) => setLinkToSchedule(e.target.checked)}
                    disabled={isUploading || schedules.length === 0}
                  />
                  <span>Link to Schedule</span>
                </label>
                {schedules.length === 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    No schedules available. Upload a schedule first.
                  </p>
                )}
              </div>

              {linkToSchedule && schedules.length > 0 && (
                <>
                  <div>
                    <label className="section-title">Schedule</label>
                    <select
                      className="input"
                      value={selectedScheduleId}
                      onChange={(e) => handleScheduleSelect(e.target.value)}
                      disabled={isUploading}
                    >
                      <option value="">Select a schedule</option>
                      {schedules.map(schedule => (
                        <option key={schedule.id} value={schedule.id}>
                          {schedule.customName || schedule.fileName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedScheduleId && (
                    <>
                      <div>
                        <label className="section-title">Schedule Column (GUID)</label>
                        {availableColumns.length > 0 ? (
                          <select
                            className="input"
                            value={selectedColumn}
                            onChange={(e) => setSelectedColumn(e.target.value)}
                            disabled={isUploading}
                          >
                            <option value="">Select column</option>
                            {availableColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input"
                            type="text"
                            value={selectedColumn}
                            onChange={(e) => setSelectedColumn(e.target.value)}
                            placeholder="Column name containing GUIDs"
                            disabled={isUploading}
                          />
                        )}
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          Column in schedule that contains GUID values to match
                        </p>
                      </div>

                      <div>
                        <label className="section-title">Model Property</label>
                        <select
                          className="input"
                          value={selectedProperty}
                          onChange={(e) => setSelectedProperty(e.target.value)}
                          disabled={isUploading}
                        >
                          <option value="">Auto-detect (will extract after upload)</option>
                          {availableProperties.map(prop => (
                            <option key={prop} value={prop}>{prop}</option>
                          ))}
                        </select>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          Property in IFC model to match with schedule GUIDs (e.g., GlobalId)
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {isUploading && uploadProgress && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'var(--accent-soft)',
                  borderRadius: '8px',
                  color: 'var(--accent-primary)'
                }}>
                  {uploadProgress}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={isUploading || !uploadFile || (linkToSchedule && (!selectedScheduleId || !selectedColumn))}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

