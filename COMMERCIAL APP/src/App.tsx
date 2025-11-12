import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ProgressDisplay, ProgressStep } from './components/ProgressDisplay';
import { ErrorDisplay } from './components/ErrorDisplay';
import { DataTable } from './components/DataTable';
import { StandardizationReview } from './components/StandardizationReview';
import { EmptyColumnReview } from './components/EmptyColumnReview';
import { GroupingModeSelector } from './components/GroupingModeSelector';
import { ManualGrouping } from './components/ManualGrouping';
import { OverviewLanding } from './components/OverviewLanding';
import { DrawingsLanding } from './components/DrawingsLanding';
import { ScheduleManagement } from './components/ScheduleManagement';
import { ProjectsLanding } from './components/ProjectsLanding';
import { Login } from './components/Login';
import { standardizeData, groupData, NRMGroup, NRMElementData } from './services/geminiService';
import { BuildingIcon, DashboardIcon, DrawingIcon, ListIcon, StarIcon, UploadIcon, FolderIcon, ArrowLeftIcon, PlusIcon, TableIcon } from './components/Icons';
import { GenericUpload } from './components/GenericUpload';
import { ActivePage } from './types/navigation';
import { Project } from './types/project';
import { User } from 'firebase/auth';
import { onAuthChange, signOutUser, getCurrentUser } from './services/authService';
import { getUserProjects, saveProject, updateProject, deleteProject } from './services/firestoreService';
import { saveCSVUpload, updateCSVUpload, getProjectCSVUploads } from './services/firestoreService';
import { uploadImage } from './services/storageService';

const App: React.FC = () => {
  // Authentication
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Project management
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [currentCSVUploadId, setCurrentCSVUploadId] = useState<string | null>(null);

  // -1: Generic Upload Selection, 0: CSV Upload, 1: Column Analysis, 2: Extract/Review, 3: Review Standardization, 4: Standardize, 4.5: Grouping Mode Selector, 4.6: Manual Grouping, 5: Group
  const [activePage, setActivePage] = useState<ActivePage>(selectedProject ? 'overview' : 'projects');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [groupingMode, setGroupingMode] = useState<'manual' | 'ai' | null>(null);
  const [manualGroups, setManualGroups] = useState<NRMGroup[]>([]);
  const [excludedRows, setExcludedRows] = useState<NRMElementData[]>([]); 
  const [extractedData, setExtractedData] = useState<NRMElementData[] | null>(null);
  const [proposedStandardizations, setProposedStandardizations] = useState<Record<string, string> | null>(null);
  const [standardizedData, setStandardizedData] = useState<NRMElementData[] | null>(null);
  const [groupedData, setGroupedData] = useState<NRMGroup[] | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  // Load projects from Firestore
  const loadProjects = useCallback(async (userId: string) => {
    setIsLoadingProjects(true);
    try {
      const userProjects = await getUserProjects(userId);
      setProjects(userProjects);
      
      // Try to restore selected project if it exists
      const savedProjectId = localStorage.getItem('selectedProjectId');
      if (savedProjectId) {
        const project = userProjects.find(p => p.id === savedProjectId);
        if (project) {
          setSelectedProject(project);
        } else {
          localStorage.removeItem('selectedProjectId');
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to load projects');
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // Authentication effect
  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      setUser(authUser);
      setIsAuthLoading(false);
      
      if (authUser) {
        // Load projects when user is authenticated
        loadProjects(authUser.uid);
      } else {
        setProjects([]);
        setSelectedProject(null);
      }
    });

    return () => unsubscribe();
  }, [loadProjects]);

  // Save project to Firestore whenever it changes (but skip if it was just created)
  useEffect(() => {
    if (!user || !selectedProject) return;
    
    // Skip auto-save if this is a brand new project (created less than 1 second ago)
    const projectAge = Date.now() - new Date(selectedProject.createdAt).getTime();
    if (projectAge < 1000) {
      return; // Project was just created, skip auto-save
    }
    
    const saveProjectToFirestore = async () => {
      try {
        await saveProject(user.uid, selectedProject);
        // Update projects list
        setProjects(prev => {
          const index = prev.findIndex(p => p.id === selectedProject.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = selectedProject;
            return updated;
          }
          return [...prev, selectedProject];
        });
      } catch (error) {
        console.error('Error saving project:', error);
      }
    };

    saveProjectToFirestore();
  }, [selectedProject, user]);

  // Update selected project in localStorage (for quick access)
  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('selectedProjectId', selectedProject.id);
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  }, [selectedProject]);

  // Sync selectedProject with projects array when projects change
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find(p => p.id === selectedProject.id);
      if (updated) {
        setSelectedProject(updated);
      } else {
        // Project was deleted, clear selection
        setSelectedProject(null);
        setActivePage('projects');
      }
    }
  }, [projects, selectedProject]);

  const handleCreateProject = useCallback(async (projectData: {
    name: string;
    location?: string;
    photo?: string;
    description?: string;
    startDate?: string;
  }) => {
    if (!user) {
      console.error('❌ Cannot create project: User not authenticated');
      setError('You must be logged in to create a project');
      return;
    }
    
    console.log('🚀 Starting project creation:', { projectName: projectData.name, userId: user.uid });
    setIsLoading(true);
    setLoadingMessage('Creating project...');
    
    try {
      // Generate project ID first
      const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('📋 Generated project ID:', projectId);
      
      // Upload image to Firebase Storage if provided
      let photoUrl: string | undefined = undefined;
      if (projectData.photo) {
        setLoadingMessage('Uploading project photo...');
        try {
          console.log('📷 Uploading photo...');
          photoUrl = await uploadImage(user.uid, projectId, projectData.photo);
          console.log('✅ Photo uploaded:', photoUrl);
        } catch (error) {
          console.error('❌ Error uploading image:', error);
          setError('Failed to upload image. Creating project without photo...');
          // Continue without photo if upload fails
        }
      }
      
      // Create project object
      const newProject: Project = {
        id: projectId,
        name: projectData.name,
        location: projectData.location,
        photo: photoUrl,
        description: projectData.description,
        startDate: projectData.startDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.displayName || user.email || 'User',
      };
      
      console.log('📦 Project object created:', newProject);
      
      // Save project to Firestore
      setLoadingMessage('Saving project...');
      await saveProject(user.uid, newProject);
      console.log('✅ Project saved to Firestore');
      
      // Reload projects from Firestore to ensure consistency
      console.log('🔄 Reloading projects from Firestore...');
      const updatedProjects = await getUserProjects(user.uid);
      console.log('📋 Loaded projects:', updatedProjects.length);
      const createdProject = updatedProjects.find(p => p.id === projectId);
      
      if (createdProject) {
        // Use the project from Firestore (has correct timestamps and any server-side processing)
        console.log('✅ Found created project in Firestore:', createdProject);
        setProjects(updatedProjects);
        setSelectedProject(createdProject);
        setActivePage('overview');
        setError(null);
        console.log('🎉 Project creation complete!');
      } else {
        // Fallback: use the project we just created (shouldn't happen, but just in case)
        console.warn('⚠️ Project not found in Firestore after save, using local copy');
        setProjects(prev => [...prev, newProject]);
        setSelectedProject(newProject);
        setActivePage('overview');
        setError(null);
      }
    } catch (error: any) {
      console.error('❌ Error creating project:', error);
      const errorMessage = error?.message || 'Failed to create project. Please try again.';
      setError(errorMessage);
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        stack: error?.stack
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [user]);

  const handleUpdateProject = useCallback(async (projectId: string, projectData: {
    name: string;
    location?: string;
    photo?: string;
    description?: string;
    startDate?: string;
  }) => {
    if (!user) {
      console.error('❌ Cannot update project: User not authenticated');
      setError('You must be logged in to update a project');
      return;
    }
    
    console.log('🔄 Starting project update:', { projectId, projectName: projectData.name, userId: user.uid });
    setIsLoading(true);
    setLoadingMessage('Updating project...');
    
    try {
      // Upload image to Firebase Storage if provided and it's a new image (base64)
      let photoUrl: string | undefined | null = undefined;
      if (projectData.photo !== undefined) {
        if (projectData.photo === null || projectData.photo === '') {
          // User wants to remove the photo
          photoUrl = null;
        } else if (projectData.photo.startsWith('data:image/')) {
          // New image uploaded (base64)
          setLoadingMessage('Uploading project photo...');
          try {
            console.log('📷 Uploading new photo...');
            photoUrl = await uploadImage(user.uid, projectId, projectData.photo);
            console.log('✅ Photo uploaded:', photoUrl);
          } catch (error) {
            console.error('❌ Error uploading image:', error);
            setError('Failed to upload image. Updating project without photo...');
            // Continue without photo if upload fails
            photoUrl = null;
          }
        } else {
          // Existing image URL, keep it
          photoUrl = projectData.photo;
        }
      }
      
      // Prepare update data
      const updateData: Partial<Project> = {
        name: projectData.name,
        location: projectData.location,
        description: projectData.description,
        startDate: projectData.startDate,
        updatedAt: new Date().toISOString(),
      };
      
      // Handle photo separately - include null to remove, undefined to keep existing
      if (photoUrl !== undefined) {
        updateData.photo = photoUrl === null ? null : photoUrl; // Pass null to delete field
      }
      
      // Remove undefined values (but keep null for photo removal)
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof Project] === undefined && key !== 'photo') {
          delete updateData[key as keyof Project];
        }
      });
      
      console.log('📦 Project update data:', updateData);
      
      // Update project in Firestore
      setLoadingMessage('Saving changes...');
      await updateProject(projectId, updateData);
      console.log('✅ Project updated in Firestore');
      
      // Reload projects from Firestore to ensure consistency
      console.log('🔄 Reloading projects from Firestore...');
      const updatedProjects = await getUserProjects(user.uid);
      console.log('📋 Loaded projects:', updatedProjects.length);
      const updatedProject = updatedProjects.find(p => p.id === projectId);
      
      if (updatedProject) {
        console.log('✅ Found updated project in Firestore:', updatedProject);
        setProjects(updatedProjects);
        
        // Update selected project if it's the one being edited
        if (selectedProject?.id === projectId) {
          setSelectedProject(updatedProject);
        }
        
        setError(null);
        console.log('🎉 Project update complete!');
      } else {
        console.warn('⚠️ Project not found in Firestore after update');
        setError('Project updated but could not reload. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('❌ Error updating project:', error);
      const errorMessage = error?.message || 'Failed to update project. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [user, selectedProject]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (!user) {
      console.error('❌ Cannot delete project: User not authenticated');
      setError('You must be logged in to delete a project');
      return;
    }
    
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }
    
    console.log('🗑️ Starting project deletion:', { projectId, userId: user.uid });
    setIsLoading(true);
    setLoadingMessage('Deleting project...');
    
    try {
      // Delete project from Firestore
      await deleteProject(projectId);
      console.log('✅ Project deleted from Firestore');
      
      // Remove from local state
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      // Clear selection if this was the selected project
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setActivePage('projects');
      }
      
      setError(null);
      console.log('🎉 Project deletion complete!');
    } catch (error: any) {
      console.error('❌ Error deleting project:', error);
      const errorMessage = error?.message || 'Failed to delete project. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [user, selectedProject]);

  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setActivePage('overview');
  }, []);

  const handleBackToProjects = useCallback(() => {
    setSelectedProject(null);
    setActivePage('projects');
  }, []);

  // Handle window resize to close mobile menu on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 920 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);
  
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

  const handleFileProcess = useCallback(async (file: File) => {
    if (!user || !selectedProject) {
      setError('Please select a project first');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Parsing CSV file...');
    setProgressSteps([{ title: 'Parsing CSV file...', status: 'active' }]);
    setError(null);
    setFileName(file.name);

    try {
      const csvData = await file.text();
      if (!csvData.trim()) throw new Error('The uploaded CSV file is empty.');
      
      const parsedData = parseCSV(csvData);
      if (parsedData.length === 0) throw new Error('CSV file contains no data rows to process.');

      setExtractedData(parsedData);
      
      // Save CSV upload to Firestore
      const uploadId = await saveCSVUpload(user.uid, selectedProject.id, {
        projectId: selectedProject.id,
        fileName: file.name,
        extractedData: parsedData
      });
      setCurrentCSVUploadId(uploadId);
      
      setCurrentStep(1); // Go to column analysis step
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `Failed to process file: ${err.message}` : 'An unknown error occurred.');
      setCurrentStep(0);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedProject]);

  const handleColumnAnalysisComplete = useCallback((filteredData: NRMElementData[]) => {
    setExtractedData(filteredData);
    setCurrentStep(2); // Move to data review step
  }, []);

  const handleProposeStandardization = useCallback(async (data: NRMElementData[]) => {
    setIsLoading(true);
    setLoadingMessage('AI is analyzing headers...');
    setProgressSteps([{ title: 'AI is analyzing headers...', status: 'active' }]);
    setError(null);
    try {
      setExtractedData(data); // Save any edits from step 2
      const headers = Array.from(new Set(data.flatMap(row => Object.keys(row))));
      const result = await standardizeData(headers);
      setProposedStandardizations(result);
      setCurrentStep(3);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `Standardization failed: ${err.message}` : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleApplyStandardization = useCallback(async (approvedChanges: Record<string, string>) => {
    if (!extractedData || !user || !selectedProject || !currentCSVUploadId) return;
    
    const finalStandardizedData = extractedData.map(row => {
        const newRow: NRMElementData = {};
        for (const key in row) {
            const newKey = approvedChanges[key] || key;
            newRow[newKey] = row[key];
        }
        return newRow;
    });
    setStandardizedData(finalStandardizedData);
    
    // Update CSV upload in Firestore
    try {
      await updateCSVUpload(currentCSVUploadId, {
        standardizedData: finalStandardizedData,
        proposedStandardizations: approvedChanges
      });
    } catch (error) {
      console.error('Error saving standardized data:', error);
    }
    
    setCurrentStep(4);
  }, [extractedData, user, selectedProject, currentCSVUploadId]);


  const handlePublishStandardizedData = useCallback(async (data: NRMElementData[]) => {
    if (!user || !selectedProject || !currentCSVUploadId) {
      throw new Error('Cannot publish: Missing user, project, or upload ID');
    }
    
    setStandardizedData(data);
    
    // Update CSV upload in Firestore with standardized data
    try {
      await updateCSVUpload(currentCSVUploadId, {
        standardizedData: data
      });
      console.log('✅ Published standardized data to Firebase');
    } catch (error) {
      console.error('❌ Error publishing standardized data:', error);
      throw error;
    }
  }, [user, selectedProject, currentCSVUploadId]);

  const handleGroupingModeSelect = useCallback(async (mode: 'manual' | 'ai') => {
    setGroupingMode(mode);
    if (mode === 'ai') {
      // Directly proceed to AI grouping
      if (standardizedData) {
        setIsLoading(true);
        setLoadingMessage('AI is grouping elements...');
        setProgressSteps([{ title: 'AI is grouping elements...', status: 'active' }]);
        setError(null);
        try {
          const result = await groupData(standardizedData);
          if (result.length === 0) {
            throw new Error("The AI model did not return any valid groupings. The data might not contain recognizable building elements.");
          }
          setGroupedData(result);
          
          // Save grouped data to Firebase
          if (user && selectedProject && currentCSVUploadId) {
            try {
              await updateCSVUpload(currentCSVUploadId, {
                standardizedData: standardizedData,
                groupedData: result
              });
              console.log('✅ Saved grouped data to Firebase');
            } catch (error) {
              console.error('❌ Error saving grouped data:', error);
            }
          }
          
          setActivePage('overview');
          setCurrentStep(0);
        } catch (err) {
          console.error(err);
          setError(err instanceof Error ? `Grouping failed: ${err.message}` : 'An unknown error occurred.');
          setCurrentStep(4.5);
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      // Show manual grouping interface
      setCurrentStep(4.6);
    }
  }, [standardizedData, user, selectedProject, currentCSVUploadId]);

  const handleManualGroupingComplete = useCallback(async (groups: NRMGroup[], excluded: NRMElementData[]) => {
    setManualGroups(groups);
    setExcludedRows(excluded);
    // Merge manual groups with any existing groups
    const allGroups = [...groups];
    setGroupedData(allGroups);
    
    // Save grouped data to Firebase
    if (user && selectedProject && currentCSVUploadId && standardizedData) {
      try {
        await updateCSVUpload(currentCSVUploadId, {
          standardizedData: standardizedData,
          groupedData: allGroups
        });
        console.log('✅ Saved grouped data to Firebase');
      } catch (error) {
        console.error('❌ Error saving grouped data:', error);
      }
    }
    
    setActivePage('overview');
    setCurrentStep(0);
  }, [user, selectedProject, currentCSVUploadId, standardizedData]);

  const handleRunAIOnRemaining = useCallback(async (remainingData: NRMElementData[]) => {
    setIsLoading(true);
    setLoadingMessage('AI is grouping remaining elements...');
    setProgressSteps([{ title: 'AI is grouping remaining elements...', status: 'active' }]);
    setError(null);
    try {
      const aiGroups = await groupData(remainingData);
      // Merge AI groups with manual groups
      const mergedGroups = [...manualGroups, ...aiGroups];
      setGroupedData(mergedGroups);
      setManualGroups(mergedGroups);
      
      // Save grouped data to Firebase
      if (user && selectedProject && currentCSVUploadId && standardizedData) {
        try {
          await updateCSVUpload(currentCSVUploadId, {
            standardizedData: standardizedData,
            groupedData: mergedGroups
          });
          console.log('✅ Saved grouped data to Firebase');
        } catch (error) {
          console.error('❌ Error saving grouped data:', error);
        }
      }
      
      setActivePage('overview');
      setCurrentStep(0);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `AI grouping failed: ${err.message}` : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [manualGroups, user, selectedProject, currentCSVUploadId, standardizedData]);

  const handleGrouping = useCallback(async (data: NRMElementData[]) => {
    if (!user || !selectedProject || !currentCSVUploadId) return;
    
    setIsLoading(true);
    setLoadingMessage('AI is grouping elements...');
    setProgressSteps([{ title: 'AI is grouping elements...', status: 'active' }]);
    setError(null);
    try {
      setStandardizedData(data); // Save any edits from step 3
      const result = await groupData(data);
      if (result.length === 0) {
          throw new Error("The AI model did not return any valid groupings. The data might not contain recognizable building elements.");
      }
      setGroupedData(result);
      
      // Update CSV upload in Firestore with grouped data
      try {
        await updateCSVUpload(currentCSVUploadId, {
          standardizedData: data,
          groupedData: result
        });
      } catch (error) {
        console.error('Error saving grouped data:', error);
      }
      
      setActivePage('overview'); // Redirect to Overview page to show results
      setCurrentStep(0); // Reset step since we're navigating away
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `Grouping failed: ${err.message}` : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedProject, currentCSVUploadId]);

  const handleReset = () => {
    setActivePage('uploads');
    setCurrentStep(-1);
    setGroupingMode(null);
    setManualGroups([]);
    setExcludedRows([]);
    setExtractedData(null);
    setStandardizedData(null);
    setProposedStandardizations(null);
    setGroupedData(null);
    setError(null);
    setIsLoading(false);
    setFileName('');
  };

  const handleSelectCSV = () => {
    setCurrentStep(0);
  };

  const handleSelectDrawing = () => {
    setActivePage('drawings');
    setCurrentStep(-1);
  };

  const renderUploadsContent = () => {
    if (isLoading) {
      return <ProgressDisplay progress={100} steps={progressSteps} />;
    }
    
    if (error) {
        return <ErrorDisplay error={error} onReset={handleReset} />;
    }

    switch (currentStep) {
      case -1:
        return (
          <GenericUpload 
            onSelectCSV={handleSelectCSV}
            onSelectDrawing={handleSelectDrawing}
          />
        );
      case 0:
        return <FileUpload onFileSelect={handleFileProcess} disabled={isLoading} />;
      case 1:
        return extractedData && (
          <EmptyColumnReview
            data={extractedData}
            onNext={handleColumnAnalysisComplete}
            onReset={handleReset}
          />
        );
      case 2:
        return extractedData && (
          <DataTable
            title="Step 2: Extracted CSV Data"
            description="Review and edit the raw data extracted from your CSV file. You can add, remove, or modify columns and values before proceeding."
            data={extractedData}
            onNext={handleProposeStandardization}
            onBack={() => setCurrentStep(1)}
            onReset={handleReset}
          />
        );
      case 3:
        return proposedStandardizations && (
          <StandardizationReview
            changes={proposedStandardizations}
            onComplete={handleApplyStandardization}
            onBack={() => setCurrentStep(2)}
            onReset={handleReset}
          />
        );
      case 4:
        return standardizedData && (
          <DataTable
            title="Step 4: Standardized Data"
            description="The AI has standardized the column headers based on your review. Make any final edits before grouping."
            data={standardizedData}
            onNext={(editedData) => {
              setStandardizedData(editedData); // Save merged/edited data
              setCurrentStep(4.5); // Go to grouping mode selector
            }}
            onBack={() => setCurrentStep(3)}
            onReset={handleReset}
            showStandardizeFunctionality={true}
            onPublish={handlePublishStandardizedData}
            showPublishButton={true}
          />
        );
      case 4.5:
        return standardizedData && (
          <GroupingModeSelector onSelectMode={handleGroupingModeSelect} />
        );
      case 4.6:
        return standardizedData && (
          <ManualGrouping
            data={standardizedData}
            onComplete={handleManualGroupingComplete}
            onBack={() => setCurrentStep(4.5)}
            onReset={handleReset}
            onRunAI={handleRunAIOnRemaining}
          />
        );
      default:
        return (
          <GenericUpload 
            onSelectCSV={handleSelectCSV}
            onSelectDrawing={handleSelectDrawing}
          />
        );
    }
  };

  const renderPageContent = () => {
    switch (activePage) {
      case 'projects':
        return (
          <ProjectsLanding
            projects={projects}
            onCreateProject={handleCreateProject}
            onSelectProject={handleSelectProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
          />
        );
      case 'overview':
        return <OverviewLanding groupedData={groupedData} fileName={fileName} onReset={handleReset} />;
      case 'uploads':
        return (
          <div className="panel">
            {renderUploadsContent()}
          </div>
        );
      case 'drawings':
        return <DrawingsLanding userId={user.uid} projectId={selectedProject?.id || ''} />;
      case 'schedules':
        return <ScheduleManagement userId={user.uid} projectId={selectedProject?.id || ''} />;
      default:
        return null;
    }
  };

  const handleNavigation = (page: ActivePage) => {
    setActivePage(page);
    setIsMobileMenuOpen(false); // Close mobile menu when navigating
    if (page === 'uploads') {
      setCurrentStep(-1);
    }
  };

  // Show login if not authenticated
  if (isAuthLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(user) => setUser(user)} />;
  }


  return (
    <div className="app-shell">
      {isMobileMenuOpen && (
        <div 
          className="sidebar-overlay sidebar-overlay--visible"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${isMobileMenuOpen ? 'sidebar--open' : ''}`}>
        <div>
          <div className="sidebar__logo">
            {selectedProject && activePage !== 'projects' ? (
              <>
                {selectedProject.photo ? (
                  <img 
                    src={selectedProject.photo} 
                    alt={selectedProject.name}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      border: '2px solid rgba(255, 255, 255, 0.2)'
                    }}
                  />
                ) : (
                  <span className="sidebar__logo-mark">DC</span>
                )}
                <div>
                  <div>{selectedProject.name}</div>
                </div>
              </>
            ) : (
              <>
                <span className="sidebar__logo-mark">DC</span>
                <div>
                  <div>ESTIMATE</div>
                  <small style={{ opacity: 0.65 }}>Automation Studio</small>
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="sidebar__nav">
          {activePage !== 'projects' && (
            <button
              className="sidebar__link"
              type="button"
              onClick={handleBackToProjects}
              style={{ marginBottom: '8px' }}
            >
              <ArrowLeftIcon />
              Back to Projects
            </button>
          )}
          {selectedProject && (
            <button
              className={`sidebar__link ${activePage === 'uploads' ? 'sidebar__link--active' : ''}`}
              type="button"
              onClick={() => {
                handleNavigation('uploads');
                setCurrentStep(-1);
              }}
              style={{ 
                justifyContent: 'center',
                backgroundColor: activePage === 'uploads' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                marginBottom: '12px',
                fontWeight: 600
              }}
              title="Upload files"
            >
              <PlusIcon />
            </button>
          )}
          <button
            className={`sidebar__link ${activePage === 'projects' ? 'sidebar__link--active' : ''}`}
            type="button"
            onClick={() => handleNavigation('projects')}
          >
            <FolderIcon />
            Projects
          </button>
          {selectedProject && (
            <>
              <button
                className={`sidebar__link ${activePage === 'overview' ? 'sidebar__link--active' : ''}`}
                type="button"
                onClick={() => handleNavigation('overview')}
              >
                <DashboardIcon />
                Overview
              </button>
              <button
                className={`sidebar__link ${activePage === 'schedules' ? 'sidebar__link--active' : ''}`}
                type="button"
                onClick={() => handleNavigation('schedules')}
              >
                <TableIcon />
                Schedules
              </button>
              <button
                className={`sidebar__link ${activePage === 'drawings' ? 'sidebar__link--active' : ''}`}
                type="button"
                onClick={() => handleNavigation('drawings')}
              >
                <DrawingIcon />
                Drawings
              </button>
            </>
          )}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__footer-title">Need help?</div>
          <div className="sidebar__footer-copy">Explore best practices for NRM alignment and schedule preparation.</div>
        </div>
      </aside>

      <div className="shell-main">
        <Header 
          activePage={activePage} 
          currentStep={currentStep} 
          onReset={handleReset}
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
          user={user}
          onSignOut={async () => {
            await signOutUser();
            setUser(null);
          }}
          selectedProject={selectedProject}
        />
        <main className="main-content">
          {renderPageContent()}
          <footer className="footer">
            Securely processes CSV schedules
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;
