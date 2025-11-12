import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';
import { DrawingIcon, PlusIcon, XIcon } from './Icons';
import { PDFViewer } from './PDFViewer';
import { PDFErrorBoundary } from './PDFErrorBoundary';
import { uploadPDF, deletePDF, getPDFBlob } from '../services/storageService';
import { saveDrawing, getProjectDrawings, updateDrawing, deleteDrawing as deleteDrawingFromFirestore, DrawingData } from '../services/firestoreService';
import { initializePDFWorker, waitForWorkerReady } from '../utils/pdfWorker';
import { pdfRenderQueue } from '../utils/pdfRenderQueue';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Initialize PDF worker on module load
initializePDFWorker();

export interface MarkupPoint {
  x: number;
  y: number;
}

export interface PolylineMarkup {
  id: string;
  points: MarkupPoint[];
  length?: number;
  label?: string;
  color?: string;
}

export interface PolygonMarkup {
  id: string;
  points: MarkupPoint[];
  area?: number;
  label?: string;
  color?: string;
}

export interface CountMarkup {
  id: string;
  x: number;
  y: number;
  type: string;
  label?: string;
  icon?: string;
  color?: string;
}

export interface Drawing {
  id: string;
  file?: File;
  fileUrl?: string;
  packageName: string;
  drawingType: string;
  scale?: {
    pixelDistance: number;
    realWorldDistance: number;
    unit: string;
  };
  polylines?: PolylineMarkup[];
  polygons?: PolygonMarkup[];
  counts?: CountMarkup[];
}

interface DrawingsLandingProps {
  userId: string;
  projectId: string;
}

export const DrawingsLanding: React.FC<DrawingsLandingProps> = ({ userId, projectId }) => {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [splittingProgress, setSplittingProgress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Load drawings from Firestore on mount
  useEffect(() => {
    const loadDrawings = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const drawingsData = await getProjectDrawings(userId, projectId);
        // Convert DrawingData to Drawing format
        const convertedDrawings: Drawing[] = await Promise.all(
          drawingsData.map(async (data) => {
            // Fetch the PDF file from URL using Firebase Storage SDK (handles CORS properly)
            let file: File | undefined;
            try {
              const blob = await getPDFBlob(data.fileUrl);
              file = new File([blob], data.fileName, { type: 'application/pdf' });
            } catch (error) {
              console.error('Error loading PDF file:', error);
            }
            
            return {
              id: data.id,
              file,
              fileUrl: data.fileUrl,
              packageName: data.packageName,
              drawingType: data.drawingType,
              scale: data.scale,
              polylines: data.polylines,
              polygons: data.polygons,
              counts: data.counts
            };
          })
        );
        setDrawings(convertedDrawings);
      } catch (error) {
        console.error('Error loading drawings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDrawings();
  }, [userId, projectId]);

  // Function to split a multi-page PDF into individual page PDFs
  const splitPDF = useCallback(async (file: File): Promise<File[]> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const pageCount = sourcePdf.getPageCount();
      
      if (pageCount <= 1) {
        // Single page PDF, return as-is
        return [file];
      }

      const baseName = file.name.replace(/\.pdf$/i, '');
      const splitFiles: File[] = [];

      // Extract each page into a separate PDF
      for (let i = 0; i < pageCount; i++) {
        setSplittingProgress(`Splitting ${file.name}: Page ${i + 1} of ${pageCount}`);
        
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
        newPdf.addPage(copiedPage);
        
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pageFileName = `${baseName}_Page${i + 1}.pdf`;
        const pageFile = new File([blob], pageFileName, { type: 'application/pdf' });
        
        splitFiles.push(pageFile);
      }

      setSplittingProgress('');
      return splitFiles;
    } catch (error) {
      console.error('Error splitting PDF:', error);
      setSplittingProgress('');
      // If splitting fails, return the original file
      return [file];
    }
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !projectId) return;

    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      alert('Please select PDF files only.');
      return;
    }

    setIsUploading(true);
    setSplittingProgress('Processing PDFs...');
    
    try {
      const allDrawings: Drawing[] = [];
      
      // Process each PDF file
      for (const file of pdfFiles) {
        // Split multi-page PDFs into individual pages
        const splitFiles = await splitPDF(file);
        
        // Upload each split file and create drawing entries
        for (const pageFile of splitFiles) {
          setSplittingProgress(`Uploading ${pageFile.name}...`);
          
          // Upload PDF to Firebase Storage
          const fileUrl = await uploadPDF(userId, projectId, pageFile);
          
          // Save drawing metadata to Firestore
          const drawingId = await saveDrawing(userId, projectId, {
            projectId,
            fileName: pageFile.name,
            fileUrl,
            packageName: '',
            drawingType: 'Plan'
          });
          
          const newDrawing: Drawing = {
            id: drawingId,
            file: pageFile,
            fileUrl,
            packageName: '',
            drawingType: 'Plan',
          };
          
          allDrawings.push(newDrawing);
        }
      }

      setDrawings(prev => [...prev, ...allDrawings]);
    } catch (error) {
      console.error('Error processing PDFs:', error);
      alert('Error processing PDF files. Please try again.');
    } finally {
      setIsUploading(false);
      setSplittingProgress('');
      event.target.value = ''; // Reset input
    }
  }, [splitPDF, userId, projectId]);

  const handleUpdateDrawing = useCallback(async (id: string, updates: Partial<Drawing>) => {
    // Update local state
    setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    if (selectedDrawing?.id === id) {
      setSelectedDrawing(prev => {
        if (!prev || prev.id !== id) return prev;
        return { ...prev, ...updates };
      });
    }
    
    // Update Firestore
    try {
      await updateDrawing(id, {
        packageName: updates.packageName,
        drawingType: updates.drawingType,
        scale: updates.scale,
        polylines: updates.polylines,
        polygons: updates.polygons,
        counts: updates.counts
      });
    } catch (error) {
      console.error('Error updating drawing:', error);
    }
  }, [selectedDrawing?.id]);

  const handleDeleteDrawing = useCallback(async (id: string) => {
    const drawing = drawings.find(d => d.id === id);
    
    // Delete from Firestore
    try {
      await deleteDrawingFromFirestore(id);
      // Delete PDF from Storage if fileUrl exists
      if (drawing?.fileUrl) {
        await deletePDF(drawing.fileUrl);
      }
    } catch (error) {
      console.error('Error deleting drawing:', error);
    }
    
    // Update local state
    setDrawings(prev => prev.filter(d => d.id !== id));
    if (selectedDrawing?.id === id) {
      setSelectedDrawing(null);
    }
  }, [selectedDrawing, drawings]);

  const handleOpenDrawing = useCallback((drawing: Drawing) => {
    setSelectedDrawing(drawing);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setSelectedDrawing(null);
  }, []);

  if (selectedDrawing) {
    return (
      <PDFViewer
        drawing={selectedDrawing}
        onUpdate={handleUpdateDrawing}
        onClose={handleCloseViewer}
      />
    );
  }

  return (
    <div className="landing-stack">
      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title">Drawing Markup</h2>
            <p className="panel__subtitle">
              Upload PDF drawings, set scales, and mark up with measurements, areas, and counts.
            </p>
          </div>
          <div className="toolbar">
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <input
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={isUploading}
              />
              <PlusIcon width={16} height={16} style={{ marginRight: 8 }} />
              Upload Drawings
            </label>
          </div>
        </header>

        {splittingProgress && (
          <div style={{
            padding: '12px 20px',
            backgroundColor: 'var(--bg-surface-muted)',
            border: '1px solid var(--border-soft)',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            color: 'var(--text-secondary)'
          }}>
            {splittingProgress}
          </div>
        )}

        {isLoading ? (
          <div style={{ 
            padding: '80px 40px', 
            textAlign: 'center',
            border: '2px dashed var(--border-strong)',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface-muted)'
          }}>
            <div>Loading drawings...</div>
          </div>
        ) : drawings.length === 0 ? (
          <div style={{ 
            padding: '80px 40px', 
            textAlign: 'center',
            border: '2px dashed var(--border-strong)',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface-muted)'
          }}>
            <DrawingIcon width={48} height={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>No drawings uploaded</h3>
            <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>
              Upload PDF drawings to get started with markup and measurements.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {drawings.map(drawing => (
              <DrawingCard
                key={drawing.id}
                drawing={drawing}
                onUpdate={handleUpdateDrawing}
                onDelete={handleDeleteDrawing}
                onOpen={handleOpenDrawing}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface DrawingCardProps {
  drawing: Drawing;
  onUpdate: (id: string, updates: Partial<Drawing>) => void;
  onDelete: (id: string) => void;
  onOpen: (drawing: Drawing) => void;
}

const DrawingCard: React.FC<DrawingCardProps> = ({ drawing, onUpdate, onDelete, onOpen }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [packageName, setPackageName] = useState(drawing.packageName);
  const [drawingType, setDrawingType] = useState(drawing.drawingType);
  const [pdfError, setPdfError] = useState(false);

  const drawingTypes = ['Plan', 'Section', 'Detail', 'Elevation', 'Site Plan', 'Floor Plan', 'Roof Plan', 'Other'];

  const handleSave = () => {
    onUpdate(drawing.id, { packageName, drawingType });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setPackageName(drawing.packageName);
    setDrawingType(drawing.drawingType);
    setIsEditing(false);
  };

  // Prevent PDF thumbnail from re-rendering when editing to avoid worker errors
  const shouldRenderThumbnail = !isEditing;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        width: '100%', 
        height: '200px', 
        backgroundColor: 'var(--bg-surface-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid var(--border-soft)',
        cursor: 'pointer',
        position: 'relative'
      }} onClick={() => !isEditing && onOpen(drawing)}>
        {shouldRenderThumbnail ? (
          <PDFThumbnail 
            file={drawing.file} 
            fileUrl={drawing.fileUrl}
            onError={() => setPdfError(true)}
          />
        ) : (
          <DrawingIcon width={48} height={48} style={{ opacity: 0.3 }} />
        )}
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600
        }}>
          PDF
        </div>
      </div>
      
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
            {drawing.file?.name || drawing.fileUrl?.split('/').pop() || 'Drawing'}
          </h4>
          
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Package Name
                </label>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g., Package A"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Drawing Type
                </label>
                <select
                  value={drawingType}
                  onChange={(e) => setDrawingType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'white'
                  }}
                >
                  {drawingTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  style={{ flex: 1, fontSize: '14px', padding: '6px 12px' }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCancel}
                  style={{ flex: 1, fontSize: '14px', padding: '6px 12px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {drawing.packageName && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <strong>Package:</strong> {drawing.packageName}
                </div>
              )}
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                <strong>Type:</strong> {drawing.drawingType}
              </div>
              {drawing.scale && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <strong>Scale:</strong> {drawing.scale.realWorldDistance} {drawing.scale.unit}
                </div>
              )}
            </div>
          )}
        </div>
        
        {!isEditing && (
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpen(drawing)}
              style={{ flex: 1, fontSize: '14px', padding: '8px' }}
            >
              Open & Markup
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsEditing(true)}
              style={{ fontSize: '14px', padding: '8px' }}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onDelete(drawing.id)}
              style={{ fontSize: '14px', padding: '8px', color: 'var(--danger)' }}
            >
              <XIcon width={16} height={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const PDFThumbnail: React.FC<{ file?: File; fileUrl?: string; onError?: () => void }> = ({ file, fileUrl, onError }) => {
  const [error, setError] = useState(false);
  const [scale, setScale] = useState<number>(0.15);
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [canRender, setCanRender] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const renderKeyRef = useRef<number>(0);

  // Ensure PDF.js worker is ready before rendering
  useEffect(() => {
    console.log('🔵 PDFThumbnail: Checking worker readiness');
    let mounted = true;
    
    const checkWorker = async () => {
      try {
        // Wait for worker to be fully ready
        await waitForWorkerReady();
        
        if (!mounted) return;
        
        const workerSrc = pdfjs.GlobalWorkerOptions.workerSrc;
        console.log('🔵 PDFThumbnail: Worker source:', workerSrc);
        if (workerSrc) {
          // Wait for worker to be fully ready (already waited in initializePDFWorker)
          // Add small additional delay to ensure message port is established
          await new Promise(resolve => setTimeout(resolve, 200));
          if (mounted) {
            setWorkerReady(true);
            console.log('✅ PDFThumbnail: Worker ready');
            
            // Queue the render to prevent race conditions
            await pdfRenderQueue.enqueue(async () => {
              if (mounted) {
                // Add a small delay between renders
                await new Promise(resolve => setTimeout(resolve, 150));
                if (mounted) {
                  setCanRender(true);
                  console.log('✅ PDFThumbnail: Can render now');
                }
              }
            });
          }
        } else {
          console.warn('⚠️ PDFThumbnail: Worker source not set, retrying...');
          setTimeout(checkWorker, 500);
        }
      } catch (error) {
        console.error('❌ PDFThumbnail: Worker check error:', error);
        if (mounted) {
          setWorkerReady(true); // Set anyway to prevent blocking
          setCanRender(true);
        }
      }
    };
    
    checkWorker();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Convert file/fileUrl to data URL to avoid CORS issues
  useEffect(() => {
    const loadPDF = async () => {
      // Clean up previous object URL if it exists
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      // Helper function to convert blob/file to data URL
      const blobToDataURL = async (blob: Blob | File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      // If we have a file, convert to data URL
      if (file) {
        try {
          const dataUrl = await blobToDataURL(file);
          setPdfDataUrl(dataUrl);
        } catch (error) {
          console.error('Error converting file to data URL:', error);
          // Fallback to object URL
          const objectUrl = URL.createObjectURL(file);
          objectUrlRef.current = objectUrl;
          setPdfDataUrl(objectUrl);
        }
        return;
      }

      // If we have a fileUrl but no file, fetch it using Firebase Storage SDK
      if (fileUrl && !file) {
        try {
          const blob = await getPDFBlob(fileUrl);
          const dataUrl = await blobToDataURL(blob);
          setPdfDataUrl(dataUrl);
        } catch (error) {
          console.error('Error loading PDF blob for thumbnail:', error);
          setPdfDataUrl(null);
          setError(true);
        }
      } else {
        setPdfDataUrl(null);
      }
    };

    loadPDF();

    // Cleanup function
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file, fileUrl]);

  const calculateScale = useCallback(() => {
    if (!containerRef.current || !pageWidth || !pageHeight) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const maxWidth = containerRect.width - 16; // Padding
    const maxHeight = containerRect.height - 16; // Padding
    
    // Calculate scale to fit within container
    const widthScale = maxWidth / pageWidth;
    const heightScale = maxHeight / pageHeight;
    
    // Use the smaller scale to ensure it fits both dimensions
    const calculatedScale = Math.min(widthScale, heightScale, 0.3); // Cap at 30% for thumbnails
    setScale(Math.max(0.05, calculatedScale)); // Minimum 5%
  }, [pageWidth, pageHeight]);

  const onPageLoadSuccess = useCallback((page: any) => {
    try {
      if (page) {
        setPageWidth(page.width);
        setPageHeight(page.height);
      }
    } catch (error) {
      console.error('Error in onPageLoadSuccess:', error);
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (pageWidth && pageHeight) {
      calculateScale();
    }
  }, [pageWidth, pageHeight, calculateScale]);

  useEffect(() => {
    const handleResize = () => {
      calculateScale();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Use ResizeObserver for more accurate container size tracking
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        calculateScale();
      });
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [calculateScale]);

  // Memoize Document options to prevent unnecessary re-renders
  const documentOptions = useMemo(() => ({
    httpHeaders: {},
    withCredentials: false,
    standardFontDataUrl: undefined,
    verbosity: 0,
    useSystemFonts: false,
  }), []);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '8px'
      }}
    >
      {error || !pdfDataUrl || !workerReady || !canRender ? (
        <DrawingIcon width={48} height={48} style={{ opacity: 0.3 }} />
      ) : (
        <div style={{ 
          maxWidth: '100%', 
          maxHeight: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <PDFErrorBoundary 
            key={renderKeyRef.current}
            onRetry={() => {
              // Force re-render by updating the key
              renderKeyRef.current += 1;
              setCanRender(false);
              setError(false);
              // Re-queue the render
              pdfRenderQueue.enqueue(async () => {
                await new Promise(resolve => setTimeout(resolve, 300));
                setCanRender(true);
              });
            }}
          >
            <Document
            file={pdfDataUrl}
            onLoadSuccess={(doc) => {
              console.log('✅ PDFThumbnail: Document loaded successfully', { numPages: doc.numPages });
            }}
            onLoadError={(error) => {
              console.error('❌ PDFThumbnail: Load error:', error);
              console.error('❌ PDFThumbnail: Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                workerSrc: pdfjs.GlobalWorkerOptions.workerSrc
              });
              setError(true);
              onError?.();
            }}
            loading={<div style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading...</div>}
            error={
              <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center' }}>
                Failed to load PDF
              </div>
            }
            options={documentOptions}
          >
            <Page
              pageNumber={1}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={(page) => {
                console.log('✅ PDFThumbnail: Page loaded successfully', { 
                  width: page.width, 
                  height: page.height,
                  workerSrc: pdfjs.GlobalWorkerOptions.workerSrc
                });
                onPageLoadSuccess(page);
              }}
              onRenderError={(error) => {
                console.error('❌ PDFThumbnail: Render error:', error);
                console.error('❌ PDFThumbnail: Render error details:', {
                  message: error.message,
                  name: error.name,
                  workerSrc: pdfjs.GlobalWorkerOptions.workerSrc
                });
                
                // If it's a sendWithPromise error, try to retry after a delay
                if (error.message?.includes('sendWithPromise') || error.message?.includes('null')) {
                  console.log('🔄 PDFThumbnail: Retrying render after worker error...');
                  setTimeout(() => {
                    renderKeyRef.current += 1;
                    setCanRender(false);
                    setError(false);
                    // Re-queue the render
                    pdfRenderQueue.enqueue(async () => {
                      await new Promise(resolve => setTimeout(resolve, 300));
                      setCanRender(true);
                    });
                  }, 500);
                } else {
                  setError(true);
                  onError?.();
                }
              }}
              onRenderSuccess={() => {
                console.log('✅ PDFThumbnail: Page rendered successfully');
              }}
              />
            </Document>
          </PDFErrorBoundary>
        </div>
      )}
    </div>
  );
};

