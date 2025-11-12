export interface Project {
  id: string;
  name: string;
  location?: string;
  photo?: string; // Base64 or URL
  description?: string;
  startDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

