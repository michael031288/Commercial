import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
  deleteField
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Project } from '../types/project';
import { Drawing } from '../components/DrawingsLanding';
import { NRMGroup, NRMElementData } from './geminiService';
import { getProcessedData } from './storageService';

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp: any): string => {
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
};

// Helper to convert ISO string to Firestore Timestamp
const isoToTimestamp = (iso: string): Timestamp => {
  return Timestamp.fromDate(new Date(iso));
};

// Projects collection
const PROJECTS_COLLECTION = 'projects';
const CSV_UPLOADS_COLLECTION = 'csvUploads';
const DRAWINGS_COLLECTION = 'drawings';
const IFC_MODELS_COLLECTION = 'ifcModels';
const PACKS_COLLECTION = 'packs';
const SCHEDULE_VIEWS_COLLECTION = 'scheduleViews';

// ============ PROJECTS ============
export const saveProject = async (userId: string, project: Project): Promise<void> => {
  try {
    console.log('💾 Saving project to Firestore:', { projectId: project.id, userId, projectName: project.name });
    const projectRef = doc(db, PROJECTS_COLLECTION, project.id);
    
    // Remove undefined values - Firestore doesn't allow undefined
    const projectData: any = {
      id: project.id,
      name: project.name,
      userId,
      createdAt: isoToTimestamp(project.createdAt),
      updatedAt: isoToTimestamp(project.updatedAt),
      createdBy: project.createdBy,
    };
    
    // Only include fields that have values (not undefined)
    if (project.location !== undefined && project.location !== null) {
      projectData.location = project.location;
    }
    if (project.photo !== undefined && project.photo !== null) {
      projectData.photo = project.photo;
    }
    if (project.description !== undefined && project.description !== null) {
      projectData.description = project.description;
    }
    if (project.startDate !== undefined && project.startDate !== null) {
      projectData.startDate = project.startDate;
    }
    
    console.log('📝 Project data to save:', projectData);
    await setDoc(projectRef, projectData);
    console.log('✅ Project saved successfully:', project.id);
  } catch (error) {
    console.error('❌ Error saving project to Firestore:', error);
    throw error;
  }
};

export const getProject = async (projectId: string): Promise<Project | null> => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) {
    return null;
  }
  
  const data = projectSnap.data();
  return {
    ...data,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt)
  } as Project;
};

export const getUserProjects = async (userId: string): Promise<Project[]> => {
  try {
    console.log('📥 Loading projects for user:', userId);
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    console.log('📋 Found projects:', querySnapshot.docs.length);
    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: timestampToISO(data.createdAt),
        updatedAt: timestampToISO(data.updatedAt)
      } as Project;
    });
    console.log('✅ Projects loaded:', projects.map(p => ({ id: p.id, name: p.name })));
    return projects;
  } catch (error: any) {
    console.error('❌ Error loading projects:', error);
    // If the error is about missing index, provide helpful message
    if (error?.code === 'failed-precondition') {
      console.error('⚠️ Firestore index missing! Create a composite index for:');
      console.error('   Collection: projects');
      console.error('   Fields: userId (Ascending), updatedAt (Descending)');
    }
    throw error;
  }
};

export const updateProject = async (projectId: string, updates: Partial<Project>): Promise<void> => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const updateData: any = {
    ...updates,
    updatedAt: Timestamp.now()
  };
  
  if (updates.createdAt) {
    updateData.createdAt = isoToTimestamp(updates.createdAt);
  }
  
  // Handle photo deletion - if photo is explicitly null, delete the field
  if (updates.photo === null) {
    updateData.photo = deleteField();
  } else if (updates.photo === undefined) {
    // Don't include photo in update if undefined (keep existing)
    delete updateData.photo;
  }
  
  await updateDoc(projectRef, updateData);
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  await deleteDoc(projectRef);
};

// ============ CSV UPLOADS ============
export interface CSVUploadData {
  id: string;
  projectId: string;
  userId: string;
  fileName: string;
  // Store file URLs instead of data arrays
  fileUrl?: string; // Original CSV file in Storage (optional for backward compatibility)
  extractedDataUrl?: string; // Processed extractedData JSON in Storage
  standardizedDataUrl?: string; // Processed standardizedData JSON in Storage
  groupedDataUrl?: string; // Processed groupedData JSON in Storage
  // Keep these for backward compatibility - will be loaded from Storage when needed
  extractedData?: NRMElementData[]; // Deprecated - use extractedDataUrl
  standardizedData?: NRMElementData[]; // Deprecated - use standardizedDataUrl
  groupedData?: NRMGroup[]; // Deprecated - use groupedDataUrl
  proposedStandardizations?: Record<string, string>;
  // Metadata fields for organization
  customName?: string;
  description?: string;
  icon?: string;
  color?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export const saveCSVUpload = async (
  userId: string, 
  projectId: string, 
  data: Omit<CSVUploadData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const uploadId = `csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const uploadRef = doc(db, CSV_UPLOADS_COLLECTION, uploadId);
  
  // Remove data arrays - they should be stored in Storage, not Firestore
  const { extractedData, standardizedData, groupedData, ...firestoreData } = data;
  
  await setDoc(uploadRef, {
    ...firestoreData,
    id: uploadId,
    userId,
    projectId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  return uploadId;
};

export const getCSVUpload = async (uploadId: string): Promise<CSVUploadData | null> => {
  const uploadRef = doc(db, CSV_UPLOADS_COLLECTION, uploadId);
  const uploadSnap = await getDoc(uploadRef);
  
  if (!uploadSnap.exists()) {
    return null;
  }
  
  const data = uploadSnap.data();
  return {
    ...data,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt)
  } as CSVUploadData;
};

export const getProjectCSVUploads = async (userId: string, projectId: string): Promise<CSVUploadData[]> => {
  try {
    console.log('📋 Fetching CSV uploads from collection:', CSV_UPLOADS_COLLECTION, { userId, projectId });
    
    // Query by projectId only to avoid composite index requirement
    // Filter by userId in memory and sort by updatedAt in memory
    const q = query(
      collection(db, CSV_UPLOADS_COLLECTION),
      where('projectId', '==', projectId)
    );
    
    const querySnapshot = await getDocs(q);
    const uploads = querySnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: timestampToISO(data.createdAt),
          updatedAt: timestampToISO(data.updatedAt)
        } as CSVUploadData;
      })
      // Filter by userId in memory
      .filter(upload => upload.userId === userId)
      // Sort by updatedAt descending in memory
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    console.log(`✅ Found ${uploads.length} CSV upload(s) in ${CSV_UPLOADS_COLLECTION} collection`);
    return uploads;
  } catch (error: any) {
    console.error('❌ Error fetching CSV uploads from', CSV_UPLOADS_COLLECTION, ':', error);
    throw error;
  }
};

export const updateCSVUpload = async (uploadId: string, updates: Partial<CSVUploadData>): Promise<void> => {
  const uploadRef = doc(db, CSV_UPLOADS_COLLECTION, uploadId);
  
  // Remove data arrays from updates - they should be stored in Storage
  const { extractedData, standardizedData, groupedData, ...firestoreUpdates } = updates;
  
  const updateData: any = {
    ...firestoreUpdates,
    updatedAt: Timestamp.now()
  };
  
  if (updates.createdAt) {
    updateData.createdAt = isoToTimestamp(updates.createdAt);
  }
  
  await updateDoc(uploadRef, updateData);
};

/**
 * Load CSV upload data with all processed data from Storage
 * This is a convenience function that loads everything needed
 */
export const loadCSVUploadData = async (uploadId: string): Promise<{
  upload: CSVUploadData;
  extractedData?: NRMElementData[];
  standardizedData?: NRMElementData[];
  groupedData?: NRMGroup[];
}> => {
  const upload = await getCSVUpload(uploadId);
  if (!upload) {
    throw new Error('CSV upload not found');
  }
  
  const result: any = { upload };
  
  // Load extractedData from Storage if URL exists
  if (upload.extractedDataUrl) {
    result.extractedData = await getProcessedData<NRMElementData[]>(upload.extractedDataUrl);
  } else if (upload.extractedData && upload.extractedData.length > 0) {
    // Fallback to deprecated field for backward compatibility
    result.extractedData = upload.extractedData;
  } else if (upload.fileUrl) {
    // If no processed data exists but CSV file exists, try to parse it
    // This handles cases where old schedules have the CSV but data wasn't saved
    try {
      const { getCSVFile } = await import('./storageService');
      const csvText = await getCSVFile(upload.fileUrl);
      // Parse CSV inline
      const parseCSV = (text: string): Record<string, string>[] => {
        const lines = text.trim().replace(/\r/g, '').split('\n');
        if (lines.length < 2) return [];
        const parseLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && (i === 0 || line[i-1] !== '"')) {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          return result.map(val => {
            let cleanVal = val.trim();
            if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
              cleanVal = cleanVal.slice(1, -1);
            }
            return cleanVal.replace(/""/g, '"');
          });
        };
        const headers = parseLine(lines[0]);
        return lines.slice(1).map(line => {
          if (!line.trim()) return null;
          const values = parseLine(line);
          const obj: Record<string, string> = {};
          headers.forEach((header, i) => {
            obj[header] = values[i] || '';
          });
          return obj;
        }).filter(Boolean) as Record<string, string>[];
      };
      result.extractedData = parseCSV(csvText);
    } catch (error) {
      console.error('Error parsing CSV file for schedule:', upload.id, error);
    }
  }
  
  // Load standardizedData from Storage if URL exists
  if (upload.standardizedDataUrl) {
    result.standardizedData = await getProcessedData<NRMElementData[]>(upload.standardizedDataUrl);
  } else if (upload.standardizedData) {
    // Fallback to deprecated field for backward compatibility
    result.standardizedData = upload.standardizedData;
  }
  
  // Load groupedData from Storage if URL exists
  if (upload.groupedDataUrl) {
    result.groupedData = await getProcessedData<NRMGroup[]>(upload.groupedDataUrl);
  } else if (upload.groupedData) {
    // Fallback to deprecated field for backward compatibility
    result.groupedData = upload.groupedData;
  }
  
  return result;
};

export const deleteCSVUpload = async (uploadId: string): Promise<void> => {
  const uploadRef = doc(db, CSV_UPLOADS_COLLECTION, uploadId);
  await deleteDoc(uploadRef);
};

// ============ PACKS ============
export interface PackData {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  type: 'drawings' | 'schedules' | 'ifcModels';
  createdAt: string;
  updatedAt: string;
}

export const savePack = async (userId: string, projectId: string, data: Omit<PackData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const packId = `pack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const packRef = doc(db, PACKS_COLLECTION, packId);
  
  await setDoc(packRef, {
    ...data,
    id: packId,
    userId,
    projectId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  return packId;
};

export const getPack = async (packId: string): Promise<PackData | null> => {
  const packRef = doc(db, PACKS_COLLECTION, packId);
  const packSnap = await getDoc(packRef);
  
  if (!packSnap.exists()) {
    return null;
  }
  
  const data = packSnap.data();
  return {
    ...data,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt)
  } as PackData;
};

export const getProjectPacks = async (userId: string, projectId: string, type?: 'drawings' | 'schedules' | 'ifcModels'): Promise<PackData[]> => {
  try {
    let q: any;
    
    if (type) {
      // Query with type filter - filter by projectId only to avoid composite index requirement
      q = query(
        collection(db, PACKS_COLLECTION),
        where('projectId', '==', projectId),
        where('type', '==', type)
      );
    } else {
      // Query without type filter
      q = query(
        collection(db, PACKS_COLLECTION),
        where('projectId', '==', projectId)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const packs = querySnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: timestampToISO(data.createdAt),
          updatedAt: timestampToISO(data.updatedAt)
        } as PackData;
      })
      // Filter by userId in memory to avoid composite index requirement
      .filter(pack => pack.userId === userId)
      // Sort by updatedAt descending in memory
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    return packs;
  } catch (error: any) {
    console.error('Error fetching packs:', error);
    // If error is about missing index, provide helpful message
    if (error?.code === 'failed-precondition') {
      console.error('⚠️ Firestore index missing! Create a composite index for:');
      console.error('   Collection: packs');
      if (type) {
        console.error('   Fields: projectId (Ascending), type (Ascending)');
      } else {
        console.error('   Fields: projectId (Ascending)');
      }
    }
    throw error;
  }
};

export const updatePack = async (packId: string, updates: Partial<PackData>): Promise<void> => {
  const packRef = doc(db, PACKS_COLLECTION, packId);
  const updateData: any = {
    updatedAt: Timestamp.now()
  };
  
  // Only include defined fields (Firestore doesn't allow undefined)
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.projectId !== undefined) updateData.projectId = updates.projectId;
  if (updates.userId !== undefined) updateData.userId = updates.userId;
  
  if (updates.createdAt) {
    updateData.createdAt = isoToTimestamp(updates.createdAt);
  }
  
  await updateDoc(packRef, updateData);
};

export const deletePack = async (packId: string): Promise<void> => {
  const packRef = doc(db, PACKS_COLLECTION, packId);
  await deleteDoc(packRef);
};

// ============ SCHEDULE VIEWS ============
export interface ScheduleViewData {
  id: string;
  scheduleId: string;
  projectId: string;
  userId: string;
  name: string;
  visibleColumns: string[]; // Array of column names to show
  columnOrder?: string[]; // Optional: custom column order
  groupByColumn?: string | null; // Column used for grouping
  expandedGroups?: string[]; // Array of expanded group keys
  showAllRows?: boolean; // Whether all rows are shown
  showAllColumns?: boolean; // Whether all columns are shown
  packId?: string; // Optional: assigned to a schedule package
  createdAt: string;
  updatedAt: string;
}

export const saveScheduleView = async (userId: string, projectId: string, scheduleId: string, data: Omit<ScheduleViewData, 'id' | 'userId' | 'projectId' | 'scheduleId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const viewId = `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const viewRef = doc(db, SCHEDULE_VIEWS_COLLECTION, viewId);
  
  // Remove undefined values - Firestore doesn't allow undefined
  const viewData: any = {
    id: viewId,
    userId,
    projectId,
    scheduleId,
    name: data.name,
    visibleColumns: data.visibleColumns,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  // Only include optional fields if they have values (Firestore allows null but not undefined)
  if (data.columnOrder !== undefined) viewData.columnOrder = data.columnOrder;
  if (data.groupByColumn !== undefined) viewData.groupByColumn = data.groupByColumn; // null is valid (no grouping)
  if (data.expandedGroups !== undefined) viewData.expandedGroups = data.expandedGroups;
  if (data.showAllRows !== undefined) viewData.showAllRows = data.showAllRows;
  if (data.showAllColumns !== undefined) viewData.showAllColumns = data.showAllColumns;
  if (data.packId !== undefined) viewData.packId = data.packId; // null is valid (no package)
  
  await setDoc(viewRef, viewData);
  
  return viewId;
};

export const getScheduleView = async (viewId: string): Promise<ScheduleViewData | null> => {
  const viewRef = doc(db, SCHEDULE_VIEWS_COLLECTION, viewId);
  const viewSnap = await getDoc(viewRef);
  
  if (!viewSnap.exists()) {
    return null;
  }
  
  const data = viewSnap.data();
  return {
    ...data,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt)
  } as ScheduleViewData;
};

export const getScheduleViews = async (userId: string, scheduleId: string): Promise<ScheduleViewData[]> => {
  try {
    const q = query(
      collection(db, SCHEDULE_VIEWS_COLLECTION),
      where('scheduleId', '==', scheduleId)
    );
    
    const querySnapshot = await getDocs(q);
    const views = querySnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: timestampToISO(data.createdAt),
          updatedAt: timestampToISO(data.updatedAt)
        } as ScheduleViewData;
      })
      .filter(view => view.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    return views;
  } catch (error: any) {
    console.error('Error fetching schedule views:', error);
    throw error;
  }
};

export const updateScheduleView = async (viewId: string, updates: Partial<ScheduleViewData>): Promise<void> => {
  const viewRef = doc(db, SCHEDULE_VIEWS_COLLECTION, viewId);
  const updateData: any = {
    updatedAt: Timestamp.now()
  };
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.visibleColumns !== undefined) updateData.visibleColumns = updates.visibleColumns;
  if (updates.columnOrder !== undefined) updateData.columnOrder = updates.columnOrder;
  if (updates.groupByColumn !== undefined) updateData.groupByColumn = updates.groupByColumn;
  if (updates.expandedGroups !== undefined) updateData.expandedGroups = updates.expandedGroups;
  if (updates.showAllRows !== undefined) updateData.showAllRows = updates.showAllRows;
  if (updates.showAllColumns !== undefined) updateData.showAllColumns = updates.showAllColumns;
  if (updates.packId !== undefined) updateData.packId = updates.packId;
  
  if (updates.createdAt) {
    updateData.createdAt = isoToTimestamp(updates.createdAt);
  }
  
  await updateDoc(viewRef, updateData);
};

export const deleteScheduleView = async (viewId: string): Promise<void> => {
  const viewRef = doc(db, SCHEDULE_VIEWS_COLLECTION, viewId);
  await deleteDoc(viewRef);
};

// ============ DRAWINGS ============
export interface DrawingData {
  id: string;
  projectId: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  packageName: string;
  drawingType: string;
  packIds?: string[]; // Array of pack IDs this drawing belongs to
  packAnnotations?: Record<string, { // Pack-specific annotations keyed by packId
    polylines?: Drawing['polylines'];
    polygons?: Drawing['polygons'];
    counts?: Drawing['counts'];
    scale?: {
      pixelDistance: number;
      realWorldDistance: number;
      unit: string;
    };
  }>;
  scale?: {
    pixelDistance: number;
    realWorldDistance: number;
    unit: string;
  };
  polylines?: Drawing['polylines'];
  polygons?: Drawing['polygons'];
  counts?: Drawing['counts'];
  createdAt: string;
  updatedAt: string;
}

export const saveDrawing = async (userId: string, projectId: string, data: Omit<DrawingData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const drawingId = `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const drawingRef = doc(db, DRAWINGS_COLLECTION, drawingId);
  
  await setDoc(drawingRef, {
    ...data,
    id: drawingId,
    userId,
    projectId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  return drawingId;
};

export const getDrawing = async (drawingId: string): Promise<DrawingData | null> => {
  const drawingRef = doc(db, DRAWINGS_COLLECTION, drawingId);
  const drawingSnap = await getDoc(drawingRef);
  
  if (!drawingSnap.exists()) {
    return null;
  }
  
  const data = drawingSnap.data();
  return {
    ...data,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt)
  } as DrawingData;
};

export const getProjectDrawings = async (userId: string, projectId: string): Promise<DrawingData[]> => {
  const q = query(
    collection(db, DRAWINGS_COLLECTION),
    where('userId', '==', userId),
    where('projectId', '==', projectId),
    orderBy('updatedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      createdAt: timestampToISO(data.createdAt),
      updatedAt: timestampToISO(data.updatedAt)
    } as DrawingData;
  });
};

export const updateDrawing = async (drawingId: string, updates: Partial<DrawingData>): Promise<void> => {
  const drawingRef = doc(db, DRAWINGS_COLLECTION, drawingId);
  const updateData: any = {
    updatedAt: Timestamp.now()
  };
  
  // Only include defined fields (Firestore doesn't allow undefined)
  if (updates.packageName !== undefined) updateData.packageName = updates.packageName;
  if (updates.drawingType !== undefined) updateData.drawingType = updates.drawingType;
  if (updates.packIds !== undefined) updateData.packIds = updates.packIds || [];
  if (updates.packAnnotations !== undefined) updateData.packAnnotations = updates.packAnnotations || {};
  if (updates.scale !== undefined) updateData.scale = updates.scale;
  if (updates.polylines !== undefined) updateData.polylines = updates.polylines;
  if (updates.polygons !== undefined) updateData.polygons = updates.polygons;
  if (updates.counts !== undefined) updateData.counts = updates.counts;
  if (updates.fileName !== undefined) updateData.fileName = updates.fileName;
  if (updates.fileUrl !== undefined) updateData.fileUrl = updates.fileUrl;
  
  if (updates.createdAt) {
    updateData.createdAt = isoToTimestamp(updates.createdAt);
  }
  
  await updateDoc(drawingRef, updateData);
};

export const deleteDrawing = async (drawingId: string): Promise<void> => {
  const drawingRef = doc(db, DRAWINGS_COLLECTION, drawingId);
  await deleteDoc(drawingRef);
};

// ============ IFC MODELS ============
export interface IFCModelData {
  id: string;
  projectId: string;
  userId: string;
  fileName: string;
  fileUrl: string; // Firebase Storage URL
  fragmentsUrl?: string; // URL to converted fragments file
  scheduleId?: string; // Linked schedule ID
  scheduleColumn?: string; // Column name in schedule containing GUIDs
  modelProperty?: string; // Property name in IFC model to match
  createdAt: string;
  updatedAt: string;
}

export const saveIFCModel = async (userId: string, projectId: string, data: Omit<IFCModelData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const modelId = `ifc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const modelRef = doc(db, IFC_MODELS_COLLECTION, modelId);
  
  // Remove undefined values - Firestore doesn't allow undefined
  const modelData: any = {
    id: modelId,
    userId,
    projectId,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  // Only include optional fields if they have values
  if (data.fragmentsUrl) {
    modelData.fragmentsUrl = data.fragmentsUrl;
  }
  if (data.scheduleId) {
    modelData.scheduleId = data.scheduleId;
  }
  if (data.scheduleColumn) {
    modelData.scheduleColumn = data.scheduleColumn;
  }
  if (data.modelProperty) {
    modelData.modelProperty = data.modelProperty;
  }
  
  await setDoc(modelRef, modelData);
  
  return modelId;
};

export const getIFCModel = async (modelId: string): Promise<IFCModelData | null> => {
  const modelRef = doc(db, IFC_MODELS_COLLECTION, modelId);
  const modelSnap = await getDoc(modelRef);
  
  if (!modelSnap.exists()) {
    return null;
  }
  
  const data = modelSnap.data();
  return {
    ...data,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt)
  } as IFCModelData;
};

export const getProjectIFCModels = async (userId: string, projectId: string): Promise<IFCModelData[]> => {
  const q = query(
    collection(db, IFC_MODELS_COLLECTION),
    where('projectId', '==', projectId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: timestampToISO(data.createdAt),
        updatedAt: timestampToISO(data.updatedAt)
      } as IFCModelData;
    })
    .filter(model => model.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const updateIFCModel = async (modelId: string, updates: Partial<IFCModelData>): Promise<void> => {
  const modelRef = doc(db, IFC_MODELS_COLLECTION, modelId);
  const updateData: any = {
    ...updates,
    updatedAt: Timestamp.now()
  };
  
  if (updates.createdAt) {
    updateData.createdAt = isoToTimestamp(updates.createdAt);
  }
  
  await updateDoc(modelRef, updateData);
};

export const deleteIFCModel = async (modelId: string): Promise<void> => {
  const modelRef = doc(db, IFC_MODELS_COLLECTION, modelId);
  await deleteDoc(modelRef);
};

