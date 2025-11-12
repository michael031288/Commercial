import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Document, Page } from 'react-pdf';
import { Drawing, MarkupPoint, PolylineMarkup, PolygonMarkup, CountMarkup } from './DrawingsLanding';
import { XIcon, EnterFullScreenIcon, ExitFullScreenIcon, TableIcon, DownloadIcon } from './Icons';
import { getPDFBlob } from '../services/storageService';
import { initializePDFWorker, waitForWorkerReady } from '../utils/pdfWorker';
import { pdfRenderQueue } from '../utils/pdfRenderQueue';
import { PDFErrorBoundary } from './PDFErrorBoundary';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Initialize PDF worker on module load
initializePDFWorker();

interface PDFViewerProps {
  drawing: Drawing;
  onUpdate: (id: string, updates: Partial<Drawing>) => void;
  onClose: () => void;
}

type MarkupMode = 'scale' | 'polyline' | 'polygon' | 'count' | 'none';
type ScaleStep = 'none' | 'point1' | 'point2';
type SidebarView = 'tools' | 'schedule';

export const PDFViewer: React.FC<PDFViewerProps> = ({ drawing, onUpdate, onClose }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [autoScale, setAutoScale] = useState(true);
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [markupMode, setMarkupMode] = useState<MarkupMode>('none');
  const [scaleStep, setScaleStep] = useState<ScaleStep>('none');
  const [scalePoint1, setScalePoint1] = useState<MarkupPoint | null>(null);
  const [scalePoint2, setScalePoint2] = useState<MarkupPoint | null>(null);
  const [scaleDistance, setScaleDistance] = useState<string>('');
  const [scaleUnit, setScaleUnit] = useState<string>('m');
  const [currentPolyline, setCurrentPolyline] = useState<MarkupPoint[]>([]);
  const [polylines, setPolylines] = useState<PolylineMarkup[]>(drawing.polylines || []);
  const [currentPolygon, setCurrentPolygon] = useState<MarkupPoint[]>([]);
  const [polygons, setPolygons] = useState<PolygonMarkup[]>(drawing.polygons || []);
  const [countType, setCountType] = useState<string>('');
  const [counts, setCounts] = useState<CountMarkup[]>(drawing.counts || []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mousePosition, setMousePosition] = useState<MarkupPoint | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>('tools');
  const [polylineLabel, setPolylineLabel] = useState<string>('');
  const [polygonLabel, setPolygonLabel] = useState<string>('');
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [isResizing, setIsResizing] = useState(false);
  const [polylineColor, setPolylineColor] = useState<string>('#2563eb');
  const [polygonColor, setPolygonColor] = useState<string>('#2563eb');
  const [countColor, setCountColor] = useState<string>('#16a34a');
  const [countIcon, setCountIcon] = useState<string>('●');
  const [usedLabels, setUsedLabels] = useState<string[]>([]);
  const [pdfFile, setPdfFile] = useState<File | Blob | string | null>(null);
  const [isLoadingPDF, setIsLoadingPDF] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [canRender, setCanRender] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const renderKeyRef = useRef<number>(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const pageLoadProcessedRef = useRef<{ pageNumber: number; width: number; height: number } | null>(null);
  const drawMarkupRef = useRef<() => void>();
  const lastContainerSizeRef = useRef<{ width: number; height: number } | null>(null);
  const isCalculatingScaleRef = useRef(false);
  const lastCalculatedScaleRef = useRef<number | null>(null);
  const scaleUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const drawingScale = drawing.scale;

  // Ensure PDF.js worker is ready before rendering
  useEffect(() => {
    console.log('🔵 PDFViewer: Checking worker readiness');
    let mounted = true;
    
    const checkWorker = async () => {
      try {
        // Wait for worker to be fully ready
        await waitForWorkerReady();
        
        if (!mounted) return;
        
        const workerSrc = pdfjs.GlobalWorkerOptions.workerSrc;
        console.log('🔵 PDFViewer: Worker source:', workerSrc);
        if (workerSrc) {
          // Wait for worker to be fully ready (already waited in initializePDFWorker)
          // Add small additional delay to ensure message port is established
          await new Promise(resolve => setTimeout(resolve, 200));
          if (mounted) {
            setWorkerReady(true);
            console.log('✅ PDFViewer: Worker ready');
            
            // Queue the render to prevent race conditions
            await pdfRenderQueue.enqueue(async () => {
              if (mounted) {
                // Add a small delay between renders
                await new Promise(resolve => setTimeout(resolve, 150));
                if (mounted) {
                  setCanRender(true);
                  console.log('✅ PDFViewer: Can render now');
                }
              }
            });
          }
        } else {
          console.warn('⚠️ PDFViewer: Worker source not set, retrying...');
          setTimeout(checkWorker, 500);
        }
      } catch (error) {
        console.error('❌ PDFViewer: Worker check error:', error);
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

  // Fetch PDF blob when drawing.file is undefined but drawing.fileUrl exists
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
      
      // If we already have a file, convert to data URL
      if (drawing.file) {
        try {
          const dataUrl = await blobToDataURL(drawing.file);
          setPdfFile(dataUrl);
        } catch (error) {
          console.error('Error converting file to data URL:', error);
          // Fallback to object URL
          const objectUrl = URL.createObjectURL(drawing.file);
          objectUrlRef.current = objectUrl;
          setPdfFile(objectUrl);
        }
        return;
      }
      
      // If we have a fileUrl but no file, fetch it using Firebase Storage SDK
      if (drawing.fileUrl && !drawing.file) {
        setIsLoadingPDF(true);
        try {
          const blob = await getPDFBlob(drawing.fileUrl);
          // Convert blob to data URL to completely avoid CORS issues
          const dataUrl = await blobToDataURL(blob);
          setPdfFile(dataUrl);
        } catch (error) {
          console.error('Error loading PDF blob:', error);
          setPdfFile(null);
        } finally {
          setIsLoadingPDF(false);
        }
      } else {
        setPdfFile(null);
      }
    };

    loadPDF();
    
    // Cleanup function to revoke object URL when component unmounts or drawing changes
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [drawing.file, drawing.fileUrl]);

  // Reload markups when drawing changes (only when ID changes to avoid loops)
  useEffect(() => {
    // Migrate old coordinates (canvas pixels) to normalized coordinates (PDF points)
    // Old coordinates were stored in canvas pixels, which were pageWidth * scale x pageHeight * scale
    // New coordinates are stored in PDF points (pageWidth x pageHeight)
    const migrateCoordinates = <T extends { x: number; y: number }>(items: T[]): T[] => {
      if (!pageWidth || !pageHeight) return items;
      return items.map(item => {
        // If coordinates are larger than page dimensions, they're likely in old format (canvas pixels)
        // We'll try to convert them, but this is a best-effort migration
        // The exact conversion depends on the scale they were created at, which we don't know
        // So we'll assume they were created at scale 1.5 (the default)
        const assumedScale = 1.5;
        if (item.x > pageWidth * 1.1 || item.y > pageHeight * 1.1) {
          // Likely old format - convert from canvas pixels to PDF points
          return {
            ...item,
            x: item.x / assumedScale,
            y: item.y / assumedScale
          };
        }
        return item;
      });
    };

    const migratedPolylines = drawing.polylines?.map(polyline => ({
      ...polyline,
      points: migrateCoordinates(polyline.points)
    })) || [];
    
    const migratedPolygons = drawing.polygons?.map(polygon => ({
      ...polygon,
      points: migrateCoordinates(polygon.points)
    })) || [];
    
    const migratedCounts = migrateCoordinates(drawing.counts || []);

    setPolylines(migratedPolylines);
    setPolygons(migratedPolygons);
    setCounts(migratedCounts);
  }, [drawing.id, pageWidth, pageHeight]);

  // Save markups to drawing whenever they change (but avoid infinite loops)
  const isUpdatingRef = useRef(false);
  useEffect(() => {
    // Only update if markups have actually changed from what's stored in drawing
    const currentPolylines = JSON.stringify(polylines);
    const currentPolygons = JSON.stringify(polygons);
    const currentCounts = JSON.stringify(counts);
    const storedPolylines = JSON.stringify(drawing.polylines || []);
    const storedPolygons = JSON.stringify(drawing.polygons || []);
    const storedCounts = JSON.stringify(drawing.counts || []);

    if (
      !isUpdatingRef.current &&
      (currentPolylines !== storedPolylines ||
      currentPolygons !== storedPolygons ||
      currentCounts !== storedCounts)
    ) {
      isUpdatingRef.current = true;
      onUpdate(drawing.id, {
        polylines,
        polygons,
        counts
      });
      // Reset flag after a short delay to allow parent update to complete
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
  }, [polylines, polygons, counts, drawing.id, onUpdate]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = useCallback((page: any) => {
    // Store the page dimensions for scale calculations
    if (page) {
      // Check if we've already processed this page load to prevent infinite loops
      const pageKey = { pageNumber, width: page.width, height: page.height };
      if (pageLoadProcessedRef.current && 
          pageLoadProcessedRef.current.pageNumber === pageKey.pageNumber &&
          pageLoadProcessedRef.current.width === pageKey.width &&
          pageLoadProcessedRef.current.height === pageKey.height) {
        return; // Already processed this page load
      }
      pageLoadProcessedRef.current = pageKey;
      
      // Only update if values actually changed to prevent infinite loops
      setPageWidth(prev => prev !== page.width ? page.width : prev);
      setPageHeight(prev => prev !== page.height ? page.height : prev);
    }
    
    // Trigger canvas resize after page loads
    setTimeout(() => {
      if (canvasRef.current && pageRef.current) {
        const canvas = canvasRef.current;
        const pageElement = pageRef.current;
        // Find the actual PDF canvas element
        const pdfCanvas = pageElement.querySelector('canvas.react-pdf__Page__canvas') as HTMLCanvasElement;
        if (pdfCanvas) {
          // Match the PDF canvas size exactly
          const rect = pdfCanvas.getBoundingClientRect();
          canvas.width = pdfCanvas.width;
          canvas.height = pdfCanvas.height;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
        } else {
          // Fallback to page element size
          const rect = pageElement.getBoundingClientRect();
          canvas.width = rect.width;
          canvas.height = rect.height;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
        }
        // Use ref to call drawMarkup to avoid dependency issues
        if (drawMarkupRef.current) {
          drawMarkupRef.current();
        }
      }
    }, 100);
  }, [pageNumber]);

  // Calculate responsive scale based on container size
  const calculateResponsiveScale = useCallback(() => {
    if (!autoScale || !viewerContainerRef.current || !pageWidth || !pageHeight) return;
    if (isCalculatingScaleRef.current) return; // Prevent concurrent calculations
    
    const container = viewerContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const currentWidth = containerRect.width;
    const currentHeight = containerRect.height;
    
    // Check if container size has changed significantly (more than 10px) to avoid micro-adjustments
    if (lastContainerSizeRef.current) {
      const widthDiff = Math.abs(lastContainerSizeRef.current.width - currentWidth);
      const heightDiff = Math.abs(lastContainerSizeRef.current.height - currentHeight);
      if (widthDiff < 10 && heightDiff < 10) {
        return; // Container size hasn't changed significantly
      }
    }
    
    isCalculatingScaleRef.current = true;
    lastContainerSizeRef.current = { width: currentWidth, height: currentHeight };
    
    const padding = 40; // Padding on each side
    const availableWidth = currentWidth - sidebarWidth - padding;
    const availableHeight = currentHeight - 100; // Account for toolbar
    
    // Calculate scale based on available space (use 90% to leave some margin)
    const widthScale = (availableWidth * 0.9) / pageWidth;
    const heightScale = (availableHeight * 0.9) / pageHeight;
    
    // Use the smaller scale to ensure it fits both dimensions
    const calculatedScale = Math.min(widthScale, heightScale, 3); // Cap at 300%
    const newScale = Math.max(0.5, calculatedScale); // Minimum 50%
    
    // Check if this is significantly different from what we last calculated
    if (lastCalculatedScaleRef.current !== null) {
      const scaleDiff = Math.abs(lastCalculatedScaleRef.current - newScale);
      if (scaleDiff < 0.1) { // Less than 10% difference
        isCalculatingScaleRef.current = false;
        return; // Don't update if scale is essentially the same
      }
    }
    
    lastCalculatedScaleRef.current = newScale;
    
    // Only update scale if it actually changed to prevent infinite loops
    setScale(prev => {
      // Use a larger epsilon (0.1 = 10%) to avoid micro-adjustments
      const shouldUpdate = Math.abs(prev - newScale) > 0.1;
      if (!shouldUpdate) {
        isCalculatingScaleRef.current = false;
        return prev;
      }
      // Reset flag after a delay to allow layout to settle
      if (scaleUpdateTimeoutRef.current) {
        clearTimeout(scaleUpdateTimeoutRef.current);
      }
      scaleUpdateTimeoutRef.current = setTimeout(() => {
        isCalculatingScaleRef.current = false;
      }, 500); // Longer delay to allow layout to settle
      return newScale;
    });
  }, [autoScale, pageWidth, pageHeight, sidebarWidth]);

  const calculateDistance = (p1: MarkupPoint, p2: MarkupPoint): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const calculatePolylineLength = (points: MarkupPoint[]): number => {
    if (points.length < 2) return 0;
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += calculateDistance(points[i - 1], points[i]);
    }
    return length;
  };

  const calculatePolygonArea = (points: MarkupPoint[]): number => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  };

  const convertPixelToRealWorld = (pixelDistance: number): number => {
    if (!drawingScale) return 0;
    return (pixelDistance / drawingScale.pixelDistance) * drawingScale.realWorldDistance;
  };

  const convertPixelAreaToRealWorld = (pixelArea: number): number => {
    if (!drawingScale) return 0;
    // Area conversion: scale factor squared
    const scaleFactor = drawingScale.realWorldDistance / drawingScale.pixelDistance;
    return pixelArea * (scaleFactor * scaleFactor);
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || markupMode === 'none' || !pageWidth || !pageHeight) {
      setMousePosition(null);
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Convert CSS coordinates to canvas coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    // Convert to normalized coordinates relative to PDF page dimensions
    const x = canvasX / canvas.width * pageWidth;
    const y = canvasY / canvas.height * pageHeight;
    setMousePosition({ x, y });
  }, [markupMode, pageWidth, pageHeight]);

  const handleCanvasMouseLeave = useCallback(() => {
    setMousePosition(null);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !pageWidth || !pageHeight) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Convert CSS coordinates to canvas coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    // Convert to normalized coordinates relative to PDF page dimensions
    // This ensures coordinates scale correctly when PDF scale changes
    const x = canvasX / canvas.width * pageWidth;
    const y = canvasY / canvas.height * pageHeight;

    if (markupMode === 'scale') {
      if (scaleStep === 'none' || scaleStep === 'point2') {
        setScalePoint1({ x, y });
        setScaleStep('point1');
      } else if (scaleStep === 'point1') {
        setScalePoint2({ x, y });
        setScaleStep('point2');
      }
    } else if (markupMode === 'polyline') {
      setCurrentPolyline(prev => [...prev, { x, y }]);
    } else if (markupMode === 'polygon') {
      setCurrentPolygon(prev => [...prev, { x, y }]);
    } else if (markupMode === 'count') {
      if (countType) {
        setCounts(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          x,
          y,
          type: countType,
          label: undefined,
          icon: countIcon,
          color: countColor
        }]);
      }
    }
  }, [markupMode, scaleStep, countType, countIcon, countColor, pageWidth, pageHeight]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (markupMode === 'polyline' && currentPolyline.length >= 2) {
      const length = calculatePolylineLength(currentPolyline);
      const label = polylineLabel || undefined;
      setPolylines(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        points: [...currentPolyline],
        length,
        label,
        color: polylineColor
      }]);
      if (label) {
        setUsedLabels(prev => prev.includes(label) ? prev : [...prev, label].sort());
      }
      setCurrentPolyline([]);
      setPolylineLabel('');
    } else if (markupMode === 'polygon' && currentPolygon.length >= 3) {
      const area = calculatePolygonArea(currentPolygon);
      const label = polygonLabel || undefined;
      setPolygons(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        points: [...currentPolygon],
        area,
        label,
        color: polygonColor
      }]);
      if (label) {
        setUsedLabels(prev => prev.includes(label) ? prev : [...prev, label].sort());
      }
      setCurrentPolygon([]);
      setPolygonLabel('');
    }
  }, [markupMode, currentPolyline, currentPolygon, polylineLabel, polygonLabel, polylineColor, polygonColor]);

  const handleApplyScale = () => {
    if (scalePoint1 && scalePoint2 && scaleDistance) {
      const pixelDistance = calculateDistance(scalePoint1, scalePoint2);
      const realWorldDistance = parseFloat(scaleDistance);
      
      onUpdate(drawing.id, {
        scale: {
          pixelDistance,
          realWorldDistance,
          unit: scaleUnit
        }
      });

      setScaleStep('none');
      setScalePoint1(null);
      setScalePoint2(null);
      setScaleDistance('');
      setMarkupMode('none');
    }
  };

  const handleCancelScale = () => {
    setScaleStep('none');
    setScalePoint1(null);
    setScalePoint2(null);
    setScaleDistance('');
    setMarkupMode('none');
  };

  const drawMarkup = useCallback(() => {
    if (!canvasRef.current || !pageWidth || !pageHeight) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Helper function to convert normalized coordinates to canvas coordinates
    const toCanvasX = (x: number) => (x / pageWidth!) * canvas.width;
    const toCanvasY = (y: number) => (y / pageHeight!) * canvas.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2563eb';
    ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
    ctx.lineWidth = 2;

    // Draw scale points and preview line
    if (markupMode === 'scale') {
      if (scalePoint1) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(toCanvasX(scalePoint1.x), toCanvasY(scalePoint1.y), 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw preview line from point1 to mouse or point2
        if (scaleStep === 'point1' && mousePosition) {
          ctx.strokeStyle = '#ef4444';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(toCanvasX(scalePoint1.x), toCanvasY(scalePoint1.y));
          ctx.lineTo(toCanvasX(mousePosition.x), toCanvasY(mousePosition.y));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      if (scalePoint2) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(toCanvasX(scalePoint2.x), toCanvasY(scalePoint2.y), 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (scalePoint1 && scalePoint2) {
        ctx.strokeStyle = '#ef4444';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(scalePoint1.x), toCanvasY(scalePoint1.y));
        ctx.lineTo(toCanvasX(scalePoint2.x), toCanvasY(scalePoint2.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw polylines (completed)
    polylines.forEach(polyline => {
      if (polyline.points.length >= 2) {
        ctx.strokeStyle = polyline.color || '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(toCanvasX(polyline.points[0].x), toCanvasY(polyline.points[0].y));
        for (let i = 1; i < polyline.points.length; i++) {
          ctx.lineTo(toCanvasX(polyline.points[i].x), toCanvasY(polyline.points[i].y));
        }
        ctx.stroke();
      }
    });

    // Draw current polyline with preview line
    if (markupMode === 'polyline') {
      if (currentPolyline.length >= 1) {
        ctx.strokeStyle = polylineColor;
        ctx.lineWidth = 2;
        // Draw points
        currentPolyline.forEach(point => {
          ctx.fillStyle = polylineColor;
          ctx.beginPath();
          ctx.arc(toCanvasX(point.x), toCanvasY(point.y), 4, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Draw lines between points
        if (currentPolyline.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(toCanvasX(currentPolyline[0].x), toCanvasY(currentPolyline[0].y));
          for (let i = 1; i < currentPolyline.length; i++) {
            ctx.lineTo(toCanvasX(currentPolyline[i].x), toCanvasY(currentPolyline[i].y));
          }
          ctx.stroke();
        }
        
        // Draw preview line from last point to mouse
        if (mousePosition && currentPolyline.length > 0) {
          const lastPoint = currentPolyline[currentPolyline.length - 1];
          ctx.strokeStyle = polylineColor;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(toCanvasX(lastPoint.x), toCanvasY(lastPoint.y));
          ctx.lineTo(toCanvasX(mousePosition.x), toCanvasY(mousePosition.y));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Draw polygons (completed)
    polygons.forEach(polygon => {
      if (polygon.points.length >= 3) {
        const color = polygon.color || '#2563eb';
        ctx.beginPath();
        ctx.moveTo(toCanvasX(polygon.points[0].x), toCanvasY(polygon.points[0].y));
        for (let i = 1; i < polygon.points.length; i++) {
          ctx.lineTo(toCanvasX(polygon.points[i].x), toCanvasY(polygon.points[i].y));
        }
        ctx.closePath();
        // Convert hex to rgba for fill
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw current polygon with preview
    if (markupMode === 'polygon') {
      if (currentPolygon.length >= 1) {
        ctx.strokeStyle = polygonColor;
        ctx.lineWidth = 2;
        // Draw points
        currentPolygon.forEach(point => {
          ctx.fillStyle = polygonColor;
          ctx.beginPath();
          ctx.arc(toCanvasX(point.x), toCanvasY(point.y), 4, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Draw lines between points
        if (currentPolygon.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(toCanvasX(currentPolygon[0].x), toCanvasY(currentPolygon[0].y));
          for (let i = 1; i < currentPolygon.length; i++) {
            ctx.lineTo(toCanvasX(currentPolygon[i].x), toCanvasY(currentPolygon[i].y));
          }
          ctx.stroke();
        }
        
        // Draw preview line from last point to mouse, and back to first point if we have 2+ points
        if (mousePosition && currentPolygon.length > 0) {
          const lastPoint = currentPolygon[currentPolygon.length - 1];
          ctx.strokeStyle = polygonColor;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(toCanvasX(lastPoint.x), toCanvasY(lastPoint.y));
          ctx.lineTo(toCanvasX(mousePosition.x), toCanvasY(mousePosition.y));
          // If we have at least 2 points, also draw preview line back to first point
          if (currentPolygon.length >= 2) {
            ctx.lineTo(toCanvasX(currentPolygon[0].x), toCanvasY(currentPolygon[0].y));
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Draw counts
    counts.forEach(count => {
      const color = count.color || '#16a34a';
      const icon = count.icon || '●';
      const canvasX = toCanvasX(count.x);
      const canvasY = toCanvasY(count.y);
      // Draw background circle in white for contrast
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Draw icon/label in the selected color
      ctx.fillStyle = color;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, canvasX, canvasY);
    });
  }, [scalePoint1, scalePoint2, scaleStep, polylines, currentPolyline, polygons, currentPolygon, counts, markupMode, mousePosition, polylineColor, polygonColor, pageWidth, pageHeight]);

  // Update drawMarkup ref whenever drawMarkup changes
  useEffect(() => {
    drawMarkupRef.current = drawMarkup;
  }, [drawMarkup]);

  // Redraw markup whenever relevant state changes
  useEffect(() => {
    drawMarkup();
  }, [drawMarkup, scalePoint1, scalePoint2, scaleStep, currentPolyline, currentPolygon, counts, mousePosition, markupMode]);

  // Reset page dimensions when page number changes
  useEffect(() => {
    setPageWidth(null);
    setPageHeight(null);
    pageLoadProcessedRef.current = null; // Reset processed flag when page changes
    lastContainerSizeRef.current = null; // Reset container size tracking
    isCalculatingScaleRef.current = false; // Reset calculation flag
    lastCalculatedScaleRef.current = null; // Reset calculated scale tracking
    if (scaleUpdateTimeoutRef.current) {
      clearTimeout(scaleUpdateTimeoutRef.current);
      scaleUpdateTimeoutRef.current = null;
    }
  }, [pageNumber]);

  // Recalculate scale when page dimensions are available
  useEffect(() => {
    if (pageWidth && pageHeight && autoScale) {
      // Reset container size tracking when page changes
      lastContainerSizeRef.current = null;
      // Use requestAnimationFrame to prevent immediate re-render loops
      requestAnimationFrame(() => {
        calculateResponsiveScale();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight, autoScale]); // calculateResponsiveScale is stable via useCallback

  // Calculate responsive scale when container size changes
  useEffect(() => {
    if (!autoScale || !pageWidth || !pageHeight) return;
    
    // Debounce function to prevent rapid recalculations
    let resizeTimeout: NodeJS.Timeout | null = null;
    const debouncedCalculateScale = () => {
      // Don't recalculate if we're currently updating scale
      if (isCalculatingScaleRef.current) return;
      
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Double-check we're not calculating before proceeding
        if (!isCalculatingScaleRef.current) {
          requestAnimationFrame(() => {
            calculateResponsiveScale();
          });
        }
      }, 300); // Increased debounce to 300ms
    };
    
    // Initial calculation only if we haven't calculated yet
    if (lastCalculatedScaleRef.current === null) {
      requestAnimationFrame(() => {
        calculateResponsiveScale();
      });
    }
    
    const handleResize = () => {
      if (autoScale && pageWidth && pageHeight && !isCalculatingScaleRef.current) {
        debouncedCalculateScale();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Use ResizeObserver for more accurate container size tracking
    let resizeObserver: ResizeObserver | null = null;
    if (viewerContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        // Don't trigger if we're currently updating scale (prevents loop)
        if (autoScale && pageWidth && pageHeight && !isCalculatingScaleRef.current) {
          debouncedCalculateScale();
        }
      });
      resizeObserver.observe(viewerContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, autoScale, pageWidth, pageHeight]); // calculateResponsiveScale is stable via useCallback

  // Track previous values to prevent unnecessary updates
  const prevScaleRef = useRef(scale);
  const prevPageNumberRef = useRef(pageNumber);
  
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current && pageRef.current) {
        const canvas = canvasRef.current;
        const pageElement = pageRef.current;
        // Find the actual PDF canvas element
        const pdfCanvas = pageElement.querySelector('canvas.react-pdf__Page__canvas') as HTMLCanvasElement;
        if (pdfCanvas) {
          // Match the PDF canvas size exactly
          const rect = pdfCanvas.getBoundingClientRect();
          canvas.width = pdfCanvas.width;
          canvas.height = pdfCanvas.height;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
        } else {
          // Fallback to page element size
          const rect = pageElement.getBoundingClientRect();
          canvas.width = rect.width;
          canvas.height = rect.height;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
        }
        drawMarkup();
      }
    };

    // Only update if scale or pageNumber actually changed
    if (prevScaleRef.current !== scale || prevPageNumberRef.current !== pageNumber) {
      prevScaleRef.current = scale;
      prevPageNumberRef.current = pageNumber;
      // Use requestAnimationFrame to batch updates and prevent flickering
      requestAnimationFrame(() => {
        updateCanvasSize();
      });
    }
    
    // Also update on window resize
    const handleResize = () => {
      requestAnimationFrame(() => {
        updateCanvasSize();
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawMarkup, scale, pageNumber]);

  const getCountByType = (type: string) => {
    return counts.filter(c => c.type === type).length;
  };

  const getCountTypes = (): string[] => {
    const types = new Set<string>();
    counts.forEach(c => {
      if (c.type) types.add(c.type);
    });
    return Array.from(types).sort();
  };

  // Track used labels from all markups
  useEffect(() => {
    const labels = new Set<string>();
    polylines.forEach(p => { if (p.label) labels.add(p.label); });
    polygons.forEach(p => { if (p.label) labels.add(p.label); });
    counts.forEach(c => { if (c.label) labels.add(c.label); });
    setUsedLabels(Array.from(labels).sort());
  }, [polylines, polygons, counts]);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(250, Math.min(800, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const exportToCSV = () => {
    const rows: string[][] = [];
    
    // Header
    rows.push(['Type', 'Label', 'Quantity', 'Unit', 'Notes']);
    
    // Polylines (Lengths)
    polylines.forEach((polyline, idx) => {
      const pixelLength = polyline.length || 0;
      const realLength = drawingScale ? convertPixelToRealWorld(pixelLength) : 0;
      const unit = drawingScale ? drawingScale.unit : 'px';
      rows.push([
        'Length',
        polyline.label || `Line ${idx + 1}`,
        drawingScale ? realLength.toFixed(2) : pixelLength.toFixed(0),
        unit,
        ''
      ]);
    });
    
    // Polygons (Areas)
    polygons.forEach((polygon, idx) => {
      const pixelArea = polygon.area || 0;
      const realArea = drawingScale ? convertPixelAreaToRealWorld(pixelArea) : 0;
      const unit = drawingScale ? `${drawingScale.unit}²` : 'px²';
      rows.push([
        'Area',
        polygon.label || `Area ${idx + 1}`,
        drawingScale ? realArea.toFixed(2) : pixelArea.toFixed(0),
        unit,
        ''
      ]);
    });
    
    // Counts
    const countGroups = counts.reduce((acc, count) => {
      const key = count.type;
      if (!acc[key]) {
        acc[key] = { type: key, count: 0, labels: [] };
      }
      acc[key].count++;
      if (count.label) {
        acc[key].labels.push(count.label);
      }
      return acc;
    }, {} as Record<string, { type: string; count: number; labels: string[] }>);
    
    Object.values(countGroups).forEach((group: { type: string; count: number; labels: string[] }) => {
      rows.push([
        'Count',
        group.type,
        group.count.toString(),
        'items',
        group.labels.length > 0 ? group.labels.join(', ') : ''
      ]);
    });
    
    // Convert to CSV
    const csvContent = rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${(drawing.file?.name || drawing.fileUrl?.split('/').pop() || 'drawing').replace('.pdf', '')}_quantities.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateMarkupLabel = (id: string, type: 'polyline' | 'polygon' | 'count', label: string) => {
    if (type === 'polyline') {
      setPolylines(prev => prev.map(p => p.id === id ? { ...p, label } : p));
    } else if (type === 'polygon') {
      setPolygons(prev => prev.map(p => p.id === id ? { ...p, label } : p));
    } else if (type === 'count') {
      setCounts(prev => prev.map(c => c.id === id ? { ...c, label } : c));
    }
    if (label && !usedLabels.includes(label)) {
      setUsedLabels(prev => [...prev, label].sort());
    }
  };

  const updateMarkupColor = (id: string, type: 'polyline' | 'polygon' | 'count', color: string) => {
    if (type === 'polyline') {
      setPolylines(prev => prev.map(p => p.id === id ? { ...p, color } : p));
    } else if (type === 'polygon') {
      setPolygons(prev => prev.map(p => p.id === id ? { ...p, color } : p));
    } else if (type === 'count') {
      setCounts(prev => prev.map(c => c.id === id ? { ...c, color } : c));
    }
  };

  const updateMarkupIcon = (id: string, icon: string) => {
    setCounts(prev => prev.map(c => c.id === id ? { ...c, icon } : c));
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Memoize Document options to prevent unnecessary re-renders
  const documentOptions = useMemo(() => ({
    httpHeaders: {},
    withCredentials: false,
    standardFontDataUrl: undefined,
    verbosity: 0,
    useSystemFonts: false,
  }), []);

  // Memoize Page component - must be called unconditionally (Rules of Hooks)
  const memoizedPageComponent = useMemo(() => (
    <div key={`pdf-page-wrapper-${pageNumber}-${scale}`}>
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onLoadSuccess={onPageLoadSuccess}
        onRenderError={(error) => {
          // Silently suppress sendWithPromise errors - PDF is usually still functional
          if (!error.message?.includes('sendWithPromise') && !error.message?.includes('null')) {
            console.error('PDF render error:', error);
            console.error('PDF render error details:', {
              message: error.message,
              name: error.name,
              workerSrc: pdfjs.GlobalWorkerOptions.workerSrc
            });
          }
        }}
        onRenderSuccess={() => {
          console.log('✅ PDFViewer: Page rendered successfully');
        }}
      />
    </div>
  ), [pageNumber, scale, onPageLoadSuccess]);

  return (
    <div ref={containerRef} style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#525252' }}>
      {/* Toolbar */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-soft)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '6px' }}
          >
            <XIcon width={20} height={20} />
          </button>
          
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            {drawing.file?.name || drawing.fileUrl?.split('/').pop() || 'Drawing'}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
              disabled={pageNumber <= 1}
              style={{ padding: '6px 12px' }}
            >
              Previous
            </button>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Page {pageNumber} of {numPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPageNumber(prev => Math.min(numPages, prev + 1))}
              disabled={pageNumber >= numPages}
              style={{ padding: '6px 12px' }}
            >
              Next
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={`btn ${autoScale ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setAutoScale(!autoScale);
                if (!autoScale) {
                  calculateResponsiveScale();
                }
              }}
              style={{ padding: '6px 12px', fontSize: '12px' }}
              title="Toggle auto-fit"
            >
              Fit
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setAutoScale(false);
                setScale(prev => Math.max(0.5, prev - 0.25));
              }}
              disabled={autoScale}
              style={{ padding: '6px 12px' }}
            >
              -
            </button>
            <span style={{ fontSize: '14px', minWidth: '60px', textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setAutoScale(false);
                setScale(prev => Math.min(3, prev + 0.25));
              }}
              disabled={autoScale}
              style={{ padding: '6px 12px' }}
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={toggleFullscreen}
          style={{ padding: '6px' }}
        >
          {isFullscreen ? <ExitFullScreenIcon width={20} height={20} /> : <EnterFullScreenIcon width={20} height={20} />}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: `${sidebarWidth}px`,
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-soft)',
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'relative'
        }}>
          {/* Resize Handle */}
          <div
            onMouseDown={() => setIsResizing(true)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              zIndex: 10
            }}
          />
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '4px',
            backgroundColor: 'var(--bg-surface-muted)',
            borderRadius: '8px',
            border: '1px solid var(--border-soft)'
          }}>
            <button
              type="button"
              onClick={() => setSidebarView('tools')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: sidebarView === 'tools' ? 'var(--accent-primary)' : 'transparent',
                color: sidebarView === 'tools' ? '#fff' : 'var(--text-secondary)',
                fontWeight: sidebarView === 'tools' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Tools
            </button>
            <button
              type="button"
              onClick={() => setSidebarView('schedule')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: sidebarView === 'schedule' ? 'var(--accent-primary)' : 'transparent',
                color: sidebarView === 'schedule' ? '#fff' : 'var(--text-secondary)',
                fontWeight: sidebarView === 'schedule' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <TableIcon width={14} height={14} />
              Schedule
            </button>
          </div>

          {sidebarView === 'tools' ? (
            <>
              {/* Markup Tools */}
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Markup Tools</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${markupMode === 'scale' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setMarkupMode('scale');
                  setScaleStep('none');
                  setCurrentPolyline([]);
                  setCurrentPolygon([]);
                }}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                Set Scale
              </button>
              <button
                type="button"
                className={`btn ${markupMode === 'polyline' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setMarkupMode('polyline');
                  setCurrentPolygon([]);
                }}
                disabled={!drawingScale}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                Measure Length
              </button>
              <button
                type="button"
                className={`btn ${markupMode === 'polygon' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setMarkupMode('polygon');
                  setCurrentPolyline([]);
                }}
                disabled={!drawingScale}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                Measure Area
              </button>
              <button
                type="button"
                className={`btn ${markupMode === 'count' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setMarkupMode('count');
                  setCurrentPolyline([]);
                  setCurrentPolygon([]);
                }}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                Count Items
              </button>
            </div>
          </div>

          {/* Scale Setting */}
          {markupMode === 'scale' && (
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface-muted)',
              borderRadius: '8px',
              border: '1px solid var(--border-soft)'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Set Scale</h4>
              {scaleStep === 'point1' && (
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Click the first point on the drawing
                </p>
              )}
              {scaleStep === 'point2' && (
                <>
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Click the second point, then enter the real-world distance
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="number"
                      value={scaleDistance}
                      onChange={(e) => setScaleDistance(e.target.value)}
                      placeholder="Distance"
                      style={{
                        padding: '8px',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                    <select
                      value={scaleUnit}
                      onChange={(e) => setScaleUnit(e.target.value)}
                      style={{
                        padding: '8px',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="ft">ft</option>
                      <option value="in">in</option>
                    </select>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleApplyScale}
                        disabled={!scaleDistance}
                        style={{ flex: 1 }}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleCancelScale}
                        style={{ flex: 1 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Polyline/Polygon Drawing Controls */}
          {(markupMode === 'polyline' || markupMode === 'polygon') && (
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface-muted)',
              borderRadius: '8px',
              border: '1px solid var(--border-soft)'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
                {markupMode === 'polyline' ? 'Measure Length' : 'Measure Area'}
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {markupMode === 'polyline' 
                  ? 'Click on the drawing to add points. Double-click or click Finish to complete.'
                  : 'Click on the drawing to add points. Double-click or click Finish to complete the area.'}
              </p>
              {markupMode === 'polyline' && currentPolyline.length >= 2 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Current Length:
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {drawingScale 
                      ? `${convertPixelToRealWorld(calculatePolylineLength(currentPolyline)).toFixed(2)} ${drawingScale.unit}`
                      : `${calculatePolylineLength(currentPolyline).toFixed(0)} px`}
                  </div>
                </div>
              )}
              {markupMode === 'polygon' && currentPolygon.length >= 3 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Current Area:
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {drawingScale 
                      ? `${convertPixelAreaToRealWorld(calculatePolygonArea(currentPolygon)).toFixed(2)} ${drawingScale.unit}²`
                      : `${calculatePolygonArea(currentPolygon).toFixed(0)} px²`}
                  </div>
                </div>
              )}
              {((markupMode === 'polyline' && currentPolyline.length >= 2) || 
                (markupMode === 'polygon' && currentPolygon.length >= 3)) && (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                      Label (optional):
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        list={`label-list-${markupMode}`}
                        value={markupMode === 'polyline' ? polylineLabel : polygonLabel}
                        onChange={(e) => {
                          if (markupMode === 'polyline') {
                            setPolylineLabel(e.target.value);
                          } else {
                            setPolygonLabel(e.target.value);
                          }
                        }}
                        placeholder="e.g., Wall A, Room 101"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid var(--border-strong)',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                      <datalist id={`label-list-${markupMode}`}>
                        {usedLabels.map(label => (
                          <option key={label} value={label} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                      Color:
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={markupMode === 'polyline' ? polylineColor : polygonColor}
                        onChange={(e) => {
                          if (markupMode === 'polyline') {
                            setPolylineColor(e.target.value);
                          } else {
                            setPolygonColor(e.target.value);
                          }
                        }}
                        style={{
                          width: '50px',
                          height: '36px',
                          border: '1px solid var(--border-strong)',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: markupMode === 'polyline' ? polylineColor : polygonColor,
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}>
                        {markupMode === 'polyline' ? polylineColor : polygonColor}
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                {(markupMode === 'polyline' && currentPolyline.length >= 2) || 
                 (markupMode === 'polygon' && currentPolygon.length >= 3) ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (markupMode === 'polyline') {
                          const length = calculatePolylineLength(currentPolyline);
                          const label = polylineLabel || undefined;
                          setPolylines(prev => [...prev, {
                            id: `${Date.now()}-${Math.random()}`,
                            points: [...currentPolyline],
                            length,
                            label,
                            color: polylineColor
                          }]);
                          if (label) {
                            setUsedLabels(prev => prev.includes(label) ? prev : [...prev, label].sort());
                          }
                          setCurrentPolyline([]);
                          setPolylineLabel('');
                        } else if (markupMode === 'polygon') {
                          const area = calculatePolygonArea(currentPolygon);
                          const label = polygonLabel || undefined;
                          setPolygons(prev => [...prev, {
                            id: `${Date.now()}-${Math.random()}`,
                            points: [...currentPolygon],
                            area,
                            label,
                            color: polygonColor
                          }]);
                          if (label) {
                            setUsedLabels(prev => prev.includes(label) ? prev : [...prev, label].sort());
                          }
                          setCurrentPolygon([]);
                          setPolygonLabel('');
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      Finish
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        if (markupMode === 'polyline') {
                          setCurrentPolyline([]);
                        } else {
                          setCurrentPolygon([]);
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    {markupMode === 'polyline' 
                      ? `Add at least 2 points (${currentPolyline.length} added)`
                      : `Add at least 3 points (${currentPolygon.length} added)`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Count Setup */}
          {markupMode === 'count' && (
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface-muted)',
              borderRadius: '8px',
              border: '1px solid var(--border-soft)'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Count Items</h4>
              <input
                type="text"
                value={countType}
                onChange={(e) => setCountType(e.target.value)}
                placeholder="Item type (e.g., Door, Window)"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginBottom: '12px'
                }}
              />
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Icon:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                  {['●', '■', '▲', '◆', '★', '✓', '✗', '○', '□', '△', '◇', '✱'].map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setCountIcon(icon)}
                      style={{
                        width: '36px',
                        height: '36px',
                        border: `2px solid ${countIcon === icon ? countColor : 'var(--border-strong)'}`,
                        borderRadius: '6px',
                        backgroundColor: countIcon === icon ? countColor : 'white',
                        color: countIcon === icon ? '#fff' : 'var(--text-primary)',
                        fontSize: '18px',
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
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Color:
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={countColor}
                    onChange={(e) => setCountColor(e.target.value)}
                    style={{
                      width: '50px',
                      height: '36px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: countColor,
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    {countColor}
                  </div>
                </div>
              </div>
              {countType && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid var(--border-soft)',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {countType} Count:
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    {getCountByType(countType)}
                  </div>
                </div>
              )}
              {getCountTypes().length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                    All Counts:
                  </div>
                  {getCountTypes().map(type => (
                    <div key={type} style={{
                      padding: '8px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      marginBottom: '4px',
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{type}:</span>
                      <strong style={{ fontSize: '16px', color: 'var(--accent-primary)' }}>{getCountByType(type)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Measurements */}
          {(polylines.length > 0 || polygons.length > 0 || counts.length > 0) && (
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Measurements</h3>
              
              {polylines.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Lengths</h4>
                  {polylines.map((polyline, idx) => {
                    const pixelLength = polyline.length || 0;
                    const realLength = drawingScale ? convertPixelToRealWorld(pixelLength) : 0;
                    return (
                      <div key={polyline.id} style={{
                        padding: '8px',
                        backgroundColor: 'var(--bg-surface-muted)',
                        borderRadius: '6px',
                        marginBottom: '4px',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>{polyline.label || `Line ${idx + 1}`}: {drawingScale ? `${realLength.toFixed(2)} ${drawingScale.unit}` : `${pixelLength.toFixed(0)} px`}</span>
                        <button
                          type="button"
                          onClick={() => setPolylines(prev => prev.filter(p => p.id !== polyline.id))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '12px'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {polygons.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Areas</h4>
                  {polygons.map((polygon, idx) => {
                    const pixelArea = polygon.area || 0;
                    const realArea = drawingScale ? convertPixelAreaToRealWorld(pixelArea) : 0;
                    return (
                      <div key={polygon.id} style={{
                        padding: '8px',
                        backgroundColor: 'var(--bg-surface-muted)',
                        borderRadius: '6px',
                        marginBottom: '4px',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>{polygon.label || `Area ${idx + 1}`}: {drawingScale ? `${realArea.toFixed(2)} ${drawingScale.unit}²` : `${pixelArea.toFixed(0)} px²`}</span>
                        <button
                          type="button"
                          onClick={() => setPolygons(prev => prev.filter(p => p.id !== polygon.id))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '12px'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {getCountTypes().length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Counts</h4>
                  {getCountTypes().map(type => (
                    <div key={type} style={{
                      padding: '8px',
                      backgroundColor: 'var(--bg-surface-muted)',
                      borderRadius: '6px',
                      marginBottom: '4px',
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{type}: <strong>{getCountByType(type)}</strong></span>
                      <button
                        type="button"
                        onClick={() => setCounts(prev => prev.filter(c => c.type !== type))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '12px'
                        }}
                        title="Clear all counts of this type"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            </>
          ) : (
            /* Schedule View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Quantities Schedule</h3>
                {(polylines.length > 0 || polygons.length > 0 || counts.length > 0) && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={exportToCSV}
                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <DownloadIcon width={14} height={14} />
                    Export CSV
                  </button>
                )}
              </div>

              {(polylines.length === 0 && polygons.length === 0 && counts.length === 0) ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: '14px'
                }}>
                  No quantities yet. Use the Tools view to add measurements and counts.
                </div>
              ) : (
                <div style={{
                  border: '1px solid var(--border-soft)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-surface)'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px'
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: 'var(--bg-surface-muted)',
                        borderBottom: '2px solid var(--border-strong)'
                      }}>
                        <th style={{
                          padding: '10px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          borderRight: '1px solid var(--border-soft)'
                        }}>Type</th>
                        <th style={{
                          padding: '10px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          borderRight: '1px solid var(--border-soft)'
                        }}>Label</th>
                        <th style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          borderRight: '1px solid var(--border-soft)'
                        }}>Quantity</th>
                        <th style={{
                          padding: '10px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          fontSize: '12px',
                          color: 'var(--text-secondary)'
                        }}>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {polylines.map((polyline, idx) => {
                        const pixelLength = polyline.length || 0;
                        const realLength = drawingScale ? convertPixelToRealWorld(pixelLength) : 0;
                        const unit = drawingScale ? drawingScale.unit : 'px';
                        return (
                          <tr key={polyline.id} style={{
                            borderBottom: '1px solid var(--border-soft)',
                            backgroundColor: 'var(--bg-surface)'
                          }}>
                            <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border-soft)', fontWeight: 500 }}>Length</td>
                            <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border-soft)' }}>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  list={`schedule-label-polyline-${polyline.id}`}
                                  value={polyline.label || `Line ${idx + 1}`}
                                  onChange={(e) => updateMarkupLabel(polyline.id, 'polyline', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    backgroundColor: 'transparent'
                                  }}
                                  onFocus={(e) => e.target.style.backgroundColor = 'white'}
                                  onBlur={(e) => e.target.style.backgroundColor = 'transparent'}
                                />
                                <datalist id={`schedule-label-polyline-${polyline.id}`}>
                                  {usedLabels.map(label => (
                                    <option key={label} value={label} />
                                  ))}
                                </datalist>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid var(--border-soft)' }}>
                              {drawingScale ? realLength.toFixed(2) : pixelLength.toFixed(0)}
                            </td>
                            <td style={{ padding: '10px 12px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <span style={{ flex: 1 }}>{unit}</span>
                              <input
                                type="color"
                                value={polyline.color || '#2563eb'}
                                onChange={(e) => updateMarkupColor(polyline.id, 'polyline', e.target.value)}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                                title="Change color"
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {polygons.map((polygon, idx) => {
                        const pixelArea = polygon.area || 0;
                        const realArea = drawingScale ? convertPixelAreaToRealWorld(pixelArea) : 0;
                        const unit = drawingScale ? `${drawingScale.unit}²` : 'px²';
                        return (
                          <tr key={polygon.id} style={{
                            borderBottom: '1px solid var(--border-soft)',
                            backgroundColor: 'var(--bg-surface)'
                          }}>
                            <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border-soft)', fontWeight: 500 }}>Area</td>
                            <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border-soft)' }}>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  list={`schedule-label-polygon-${polygon.id}`}
                                  value={polygon.label || `Area ${idx + 1}`}
                                  onChange={(e) => updateMarkupLabel(polygon.id, 'polygon', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    backgroundColor: 'transparent'
                                  }}
                                  onFocus={(e) => e.target.style.backgroundColor = 'white'}
                                  onBlur={(e) => e.target.style.backgroundColor = 'transparent'}
                                />
                                <datalist id={`schedule-label-polygon-${polygon.id}`}>
                                  {usedLabels.map(label => (
                                    <option key={label} value={label} />
                                  ))}
                                </datalist>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid var(--border-soft)' }}>
                              {drawingScale ? realArea.toFixed(2) : pixelArea.toFixed(0)}
                            </td>
                            <td style={{ padding: '10px 12px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <span style={{ flex: 1 }}>{unit}</span>
                              <input
                                type="color"
                                value={polygon.color || '#2563eb'}
                                onChange={(e) => updateMarkupColor(polygon.id, 'polygon', e.target.value)}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                                title="Change color"
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {getCountTypes().map(type => {
                        const typeCounts = counts.filter(c => c.type === type);
                        const firstCount = typeCounts[0];
                        return (
                          <tr key={type} style={{
                            borderBottom: '1px solid var(--border-soft)',
                            backgroundColor: 'var(--bg-surface)'
                          }}>
                            <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border-soft)', fontWeight: 500 }}>Count</td>
                            <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border-soft)' }}>
                              <input
                                type="text"
                                value={type}
                                onChange={(e) => {
                                  // Update all counts of this type
                                  setCounts(prev => prev.map(c => c.type === type ? { ...c, type: e.target.value } : c));
                                }}
                                style={{
                                  width: '100%',
                                  padding: '4px 8px',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  backgroundColor: 'transparent'
                                }}
                                onFocus={(e) => e.target.style.backgroundColor = 'white'}
                                onBlur={(e) => e.target.style.backgroundColor = 'transparent'}
                              />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid var(--border-soft)' }}>
                              {typeCounts.length}
                            </td>
                            <td style={{ padding: '10px 12px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <span style={{ flex: 1 }}>items</span>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <select
                                  value={firstCount?.icon || '●'}
                                  onChange={(e) => {
                                    // Update all counts of this type
                                    setCounts(prev => prev.map(c => c.type === type ? { ...c, icon: e.target.value } : c));
                                  }}
                                  style={{
                                    width: '32px',
                                    height: '24px',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    padding: '2px'
                                  }}
                                  title="Change icon"
                                >
                                  {['●', '■', '▲', '◆', '★', '✓', '✗', '○', '□', '△', '◇', '✱'].map(icon => (
                                    <option key={icon} value={icon}>{icon}</option>
                                  ))}
                                </select>
                                <input
                                  type="color"
                                  value={firstCount?.color || '#16a34a'}
                                  onChange={(e) => {
                                    // Update all counts of this type
                                    setCounts(prev => prev.map(c => c.type === type ? { ...c, color: e.target.value } : c));
                                  }}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                  title="Change color"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PDF Viewer */}
        <div 
          ref={viewerContainerRef}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', position: 'relative' }}
        >
          <div ref={pageRef} style={{ position: 'relative', display: 'inline-block' }}>
            {pdfFile && workerReady && canRender ? (
              <div key={renderKeyRef.current}>
              <PDFErrorBoundary>
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={(error) => {
                    console.error('PDF load error:', error);
                    console.error('PDF load error details:', {
                      message: error.message,
                      name: error.name,
                      workerSrc: pdfjs.GlobalWorkerOptions.workerSrc
                    });
                  }}
                  loading={<div style={{ color: 'white' }}>Loading PDF...</div>}
                  error={
                    <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>
                      Failed to load PDF. Please try again.
                    </div>
                  }
                  options={documentOptions}
                >
                  {memoizedPageComponent}
                </Document>
              </PDFErrorBoundary>
              </div>
            ) : pdfFile && !canRender ? (
              <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>
                Initializing PDF viewer...
              </div>
            ) : null}
            {isLoadingPDF && (
              <div style={{ color: 'white', padding: '20px' }}>Loading PDF...</div>
            )}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                cursor: markupMode !== 'none' ? 'crosshair' : 'default',
                pointerEvents: markupMode !== 'none' ? 'auto' : 'none'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

