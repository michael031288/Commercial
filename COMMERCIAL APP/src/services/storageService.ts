import { ref, uploadBytes, getDownloadURL, deleteObject, getBytes } from 'firebase/storage';
import { storage } from '../config/firebase';

export const uploadPDF = async (userId: string, projectId: string, file: File): Promise<string> => {
  const fileName = `${userId}/${projectId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, fileName);
  
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  
  return downloadURL;
};

export const uploadImage = async (userId: string, projectId: string, base64String: string): Promise<string> => {
  try {
    console.log('📤 Uploading image to Firebase Storage:', { userId, projectId });
    // Convert base64 string to Blob
    const base64Data = base64String.split(',')[1] || base64String; // Remove data URL prefix if present
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    // Create a File from the Blob
    const fileName = `${userId}/${projectId}/project-photo-${Date.now()}.jpg`;
    const storageRef = ref(storage, fileName);
    
    console.log('📁 Uploading to path:', fileName);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Image uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading image to Firebase Storage:', error);
    throw error;
  }
};

export const deletePDF = async (fileUrl: string): Promise<void> => {
  // Extract the path from the URL
  const url = new URL(fileUrl);
  const path = decodeURIComponent(url.pathname.split('/o/')[1]?.split('?')[0] || '');
  
  if (path) {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  }
};

/**
 * Extract storage path from Firebase Storage download URL
 */
const extractStoragePath = (fileUrl: string): string | null => {
  try {
    const url = new URL(fileUrl);
    const path = decodeURIComponent(url.pathname.split('/o/')[1]?.split('?')[0] || '');
    return path || null;
  } catch (error) {
    console.error('Error extracting storage path from URL:', error);
    return null;
  }
};

/**
 * Get PDF file as Blob from Firebase Storage URL
 * This handles CORS properly by using Firebase Storage SDK
 */
export const getPDFBlob = async (fileUrl: string): Promise<Blob> => {
  console.log('📥 getPDFBlob: Fetching PDF from URL:', fileUrl);
  const path = extractStoragePath(fileUrl);
  console.log('📥 getPDFBlob: Extracted path:', path);
  
  if (!path) {
    console.warn('⚠️ getPDFBlob: Could not extract path, falling back to fetch (may have CORS issues)');
    // Fallback to fetch if we can't extract the path
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    return await response.blob();
  }
  
  try {
    // Use Firebase Storage SDK which handles CORS properly
    const storageRef = ref(storage, path);
    console.log('📥 getPDFBlob: Using Firebase Storage SDK to fetch:', path);
    const bytes = await getBytes(storageRef);
    console.log('✅ getPDFBlob: Successfully fetched PDF bytes:', bytes?.length ?? 'unknown', 'bytes');
    // Convert Uint8Array to Blob
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return blob;
  } catch (error) {
    console.error('❌ getPDFBlob: Error fetching from Firebase Storage:', error);
    throw error;
  }
};

