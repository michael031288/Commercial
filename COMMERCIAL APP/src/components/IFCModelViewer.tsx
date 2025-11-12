import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IFCModelData, getIFCModel } from '../services/firestoreService';
import { loadCSVUploadData, CSVUploadData } from '../services/firestoreService';
import { IFCViewer } from './IFCViewer';
import { NRMElementData } from '../services/geminiService';
import { ArrowLeftIcon } from './Icons';

interface IFCModelViewerProps {
  model: IFCModelData;
  userId: string;
  projectId: string;
  onBack: () => void;
}

export const IFCModelViewer: React.FC<IFCModelViewerProps> = ({
  model,
  userId,
  projectId,
  onBack
}) => {
  const [schedule, setSchedule] = useState<CSVUploadData | null>(null);
  const [scheduleData, setScheduleData] = useState<NRMElementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [highlightedElements, setHighlightedElements] = useState<string[]>([]);
  const [guidMapping, setGuidMapping] = useState<Map<string, string[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Load schedule data
  useEffect(() => {
    const loadSchedule = async () => {
      if (!model.scheduleId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { upload: loadedSchedule, extractedData, standardizedData } = await loadCSVUploadData(model.scheduleId);
        if (loadedSchedule) {
          setSchedule(loadedSchedule);
          
          // Get editable data
          const editableData = standardizedData || extractedData || [];
          setScheduleData(editableData);

          // Build GUID mapping
          if (model.scheduleColumn && model.modelProperty) {
            buildGUIDMapping(editableData, model.scheduleColumn, model.modelProperty);
          }
        }
      } catch (err) {
        console.error('Error loading schedule:', err);
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
      } finally {
        setIsLoading(false);
      }
    };

    loadSchedule();
  }, [model.scheduleId, model.scheduleColumn, model.modelProperty]);

  const buildGUIDMapping = useCallback(async (data: NRMElementData[], scheduleColumn: string, modelProperty: string) => {
    // This is a simplified mapping - in production you'd extract actual GUIDs from the IFC model
    // For now, we'll create a mapping based on schedule GUIDs
    const mapping = new Map<string, string[]>();
    
    data.forEach((row, index) => {
      const guid = String(row[scheduleColumn] || '').trim();
      if (guid) {
        // Normalize GUID (case-insensitive)
        const normalizedGuid = guid.toLowerCase();
        
        // In a real implementation, you'd query the IFC model for elements with matching property
        // For now, we'll use a placeholder that would be replaced with actual element IDs
        // The actual implementation would use ThatOpen API to find elements by property
        const elementIds = [`element-${index}`]; // Placeholder
        mapping.set(normalizedGuid, elementIds);
      }
    });

    setGuidMapping(mapping);
  }, []);

  const handleScheduleRowClick = (index: number) => {
    setSelectedRowIndex(index);
    
    const row = scheduleData[index];
    if (row && model.scheduleColumn) {
      const guid = String(row[model.scheduleColumn] || '').trim().toLowerCase();
      if (guid && guidMapping.has(guid)) {
        const elementIds = guidMapping.get(guid) || [];
        setHighlightedElements(elementIds);
      } else {
        setHighlightedElements([]);
      }
    }
  };

  const handleModelElementRightClick = (elementId: string, properties: Record<string, any>) => {
    // Find schedule row by matching GUID
    if (!model.scheduleColumn || !model.modelProperty) return;

    const elementGuid = String(properties[model.modelProperty] || '').trim().toLowerCase();
    if (!elementGuid) return;

    // Find matching row in schedule
    const matchingIndex = scheduleData.findIndex(row => {
      const rowGuid = String(row[model.scheduleColumn!] || '').trim().toLowerCase();
      return rowGuid === elementGuid;
    });

    if (matchingIndex >= 0) {
      setSelectedRowIndex(matchingIndex);
      
      // Scroll to row
      if (tableRef.current) {
        const rowElement = tableRef.current.querySelector(`[data-row-index="${matchingIndex}"]`);
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight briefly
          (rowElement as HTMLElement).style.backgroundColor = 'var(--accent-soft)';
          setTimeout(() => {
            (rowElement as HTMLElement).style.backgroundColor = '';
          }, 2000);
        }
      }
    }
  };

  const handleModelElementClick = (elementId: string, properties: Record<string, any>) => {
    // Highlight clicked element
    setHighlightedElements([elementId]);
  };

  if (isLoading) {
    return (
      <div className="landing-stack">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading schedule and model...
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="landing-stack">
        <div style={{
          padding: '20px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: 'var(--danger)'
        }}>
          {error || 'Schedule not found'}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="btn btn-ghost"
        >
          <ArrowLeftIcon width={16} height={16} style={{ marginRight: '8px' }} />
          Back to Models
        </button>
      </div>
    );
  }

  const headers = scheduleData.length > 0 ? Object.keys(scheduleData[0]) : [];

  return (
    <div className="landing-stack">
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="panel__title">{model.fileName}</h2>
          <p className="panel__subtitle" style={{ marginTop: '4px' }}>
            Linked to: {schedule.customName || schedule.fileName}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="btn btn-ghost"
        >
          <ArrowLeftIcon width={16} height={16} style={{ marginRight: '8px' }} />
          Back to Models
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        height: 'calc(100vh - 200px)',
        minHeight: '600px'
      }}>
        {/* Schedule Table */}
        <div style={{
          border: '1px solid var(--border-strong)',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-strong)',
            backgroundColor: 'var(--bg-surface-muted)',
            fontWeight: 600,
            fontSize: '14px',
            color: 'var(--text-primary)'
          }}>
            Schedule Data ({scheduleData.length} rows)
          </div>
          <div
            ref={tableRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'auto'
            }}
          >
            {scheduleData.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No data available
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-surface)', zIndex: 10 }}>
                  <tr>
                    {headers.slice(0, 10).map((header, idx) => (
                      <th
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          borderBottom: '2px solid var(--border-strong)',
                          whiteSpace: 'nowrap',
                          backgroundColor: 'var(--bg-surface)'
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      data-row-index={rowIndex}
                      onClick={() => handleScheduleRowClick(rowIndex)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedRowIndex === rowIndex ? 'var(--accent-soft)' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedRowIndex !== rowIndex) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-surface-muted)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedRowIndex !== rowIndex) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {headers.slice(0, 10).map((header, colIndex) => (
                        <td
                          key={colIndex}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={String(row[header] || '')}
                        >
                          {String(row[header] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-strong)',
            backgroundColor: 'var(--bg-surface-muted)',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            Click a row to highlight elements in the 3D model. Right-click elements in the model to find them in the schedule.
          </div>
        </div>

        {/* 3D Viewer */}
        <div style={{
          border: '1px solid var(--border-strong)',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#1a1a1a'
        }}>
          <IFCViewer
            fragmentsUrl={model.fragmentsUrl}
            ifcUrl={model.fileUrl}
            onElementClick={handleModelElementClick}
            onElementRightClick={handleModelElementRightClick}
            highlightedElements={highlightedElements}
            containerStyle={{ width: '100%', height: '100%' }}
          />
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '6px',
            fontSize: '12px',
            pointerEvents: 'none'
          }}>
            Right-click elements to find in schedule
          </div>
        </div>
      </div>
    </div>
  );
};

