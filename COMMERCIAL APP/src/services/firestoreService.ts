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
  extractedData: NRMElementData[];
  standardizedData?: NRMElementData[];
  groupedData?: NRMGroup[];
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

export const saveCSVUpload = async (userId: string, projectId: string, data: Omit<CSVUploadData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const uploadId = `csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const uploadRef = doc(db, CSV_UPLOADS_COLLECTION, uploadId);
  
  await setDoc(uploadRef, {
    ...data,
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
  const updateData: any = {
    ...updates,
    updatedAt: Timestamp.now()
  };
  
  if (updates.createdAt) {
    updateData.createdAt = isoToTimestamp(updates.createdAt);
  }
  
  await updateDoc(uploadRef, updateData);
};

export const deleteCSVUpload = async (uploadId: string): Promise<void> => {
  const uploadRef = doc(db, CSV_UPLOADS_COLLECTION, uploadId);
  await deleteDoc(uploadRef);
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
    ...updates,
    updatedAt: Timestamp.now()
  };
  
  if (updates.createdAt) {
    updateData.createdAt = isoToTimestamp(updates.createdAt);
  }
  
  await updateDoc(drawingRef, updateData);
};

export const deleteDrawing = async (drawingId: string): Promise<void> => {
  const drawingRef = doc(db, DRAWINGS_COLLECTION, drawingId);
  await deleteDoc(drawingRef);
};

