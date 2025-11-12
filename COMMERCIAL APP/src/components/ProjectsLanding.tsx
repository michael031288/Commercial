import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Project } from '../types/project';
import { FolderIcon, PlusIcon, BuildingIcon, DrawingIcon, ListIcon, TableIcon, XIcon, UploadIcon, EditIcon, TrashIcon } from './Icons';

interface ProjectsLandingProps {
  projects: Project[];
  onCreateProject: (projectData: {
    name: string;
    location?: string;
    photo?: string;
    description?: string;
    startDate?: string;
  }) => Promise<void>;
  onSelectProject: (project: Project) => void;
  onUpdateProject: (projectId: string, projectData: {
    name: string;
    location?: string;
    photo?: string;
    description?: string;
    startDate?: string;
  }) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export const ProjectsLanding: React.FC<ProjectsLandingProps> = ({
  projects,
  onCreateProject,
  onSelectProject,
  onUpdateProject,
  onDeleteProject,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectPhoto, setProjectPhoto] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isModalOpen || isEditModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isEditModalOpen]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setProjectName('');
    setProjectLocation('');
    setProjectDescription('');
    setProjectStartDate('');
    setProjectPhoto(null);
    setPhotoPreview(null);
    setIsCreating(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectLocation(project.location || '');
    setProjectDescription(project.description || '');
    setProjectStartDate(project.startDate || '');
    setProjectPhoto(project.photo || null);
    setPhotoPreview(project.photo || null);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingProject(null);
    setProjectName('');
    setProjectLocation('');
    setProjectDescription('');
    setProjectStartDate('');
    setProjectPhoto(null);
    setPhotoPreview(null);
    setIsUpdating(false);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  const handlePhotoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    // Check file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB. Please compress the image or choose a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      
      // Compress image if it's too large
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize if image is too large (max 800px on longest side)
        const maxDimension = 800;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Convert to JPEG with 0.8 quality to reduce size
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setProjectPhoto(compressedBase64);
          setPhotoPreview(compressedBase64);
        } else {
          // Fallback to original if canvas fails
          setProjectPhoto(base64String);
          setPhotoPreview(base64String);
        }
      };
      img.onerror = () => {
        alert('Error loading image. Please try again.');
      };
      img.src = base64String;
    };
    reader.onerror = () => {
      alert('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemovePhoto = () => {
    setProjectPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  const handleSubmitCreate = useCallback(async () => {
    if (!projectName.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      await onCreateProject({
        name: projectName.trim(),
        location: projectLocation.trim() || undefined,
        photo: projectPhoto || undefined,
        description: projectDescription.trim() || undefined,
        startDate: projectStartDate || undefined,
      });
      handleCloseModal();
    } catch (error) {
      console.error('Error creating project:', error);
      // Modal stays open on error so user can try again
    } finally {
      setIsCreating(false);
    }
  }, [projectName, projectLocation, projectPhoto, projectDescription, projectStartDate, onCreateProject, isCreating]);

  const handleSubmitUpdate = useCallback(async () => {
    if (!projectName.trim() || !editingProject || isUpdating) return;
    
    setIsUpdating(true);
    try {
      // Determine photo value: if projectPhoto is null and project originally had a photo, user wants to remove it
      let photoValue: string | undefined | null = undefined;
      if (projectPhoto !== null) {
        // User has selected a photo (new or existing)
        photoValue = projectPhoto;
      } else if (editingProject.photo) {
        // User removed the photo (projectPhoto is null but project had a photo)
        photoValue = null;
      }
      // Otherwise photoValue stays undefined (no change)
      
      await onUpdateProject(editingProject.id, {
        name: projectName.trim(),
        location: projectLocation.trim() || undefined,
        photo: photoValue,
        description: projectDescription.trim() || undefined,
        startDate: projectStartDate || undefined,
      });
      handleCloseEditModal();
    } catch (error) {
      console.error('Error updating project:', error);
      // Modal stays open on error so user can try again
    } finally {
      setIsUpdating(false);
    }
  }, [projectName, projectLocation, projectPhoto, projectDescription, projectStartDate, editingProject, onUpdateProject, isUpdating]);

  const handleDeleteProject = useCallback(async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    try {
      await onDeleteProject(projectId);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  }, [onDeleteProject]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isEditModalOpen) {
        handleCloseEditModal();
      } else {
        handleCloseModal();
      }
    }
  };

  return (
    <div className="landing-stack">
      {isModalOpen && (
        <>
          <div
            className="modal-overlay"
            onClick={handleCloseModal}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          />
          <div
            className="modal"
            onKeyDown={handleKeyPress}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 1001,
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Create New Project</h2>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <XIcon width={20} height={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Photo Upload */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Project Photo
                  </label>
                  {photoPreview ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={photoPreview}
                        alt="Project preview"
                        style={{
                          width: '100%',
                          maxWidth: '200px',
                          height: '150px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '1px solid var(--border-soft)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(0, 0, 0, 0.7)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'white',
                        }}
                      >
                        <XIcon width={16} height={16} />
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px',
                        border: '2px dashed var(--border-strong)',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-surface-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-strong)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface-muted)';
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        style={{ display: 'none' }}
                      />
                      <UploadIcon width={32} height={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Upload Photo
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        PNG, JPG up to 2MB (will be compressed)
                      </span>
                    </label>
                  )}
                </div>

                {/* Project Name */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Project Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Hospital West Project"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                    }}
                  />
                </div>

                {/* Location */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    placeholder="e.g., London, UK"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                    }}
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={projectStartDate}
                    onChange={(e) => setProjectStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Add a description for this project..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmitCreate}
                    disabled={!projectName.trim() || isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isEditModalOpen && editingProject && (
        <>
          <div
            className="modal-overlay"
            onClick={handleCloseEditModal}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          />
          <div
            className="modal"
            onKeyDown={handleKeyPress}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 1001,
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Edit Project</h2>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <XIcon width={20} height={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Photo Upload */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Project Photo
                  </label>
                  {photoPreview ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={photoPreview}
                        alt="Project preview"
                        style={{
                          width: '100%',
                          maxWidth: '200px',
                          height: '150px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '1px solid var(--border-soft)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(0, 0, 0, 0.7)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'white',
                        }}
                      >
                        <XIcon width={16} height={16} />
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px',
                        border: '2px dashed var(--border-strong)',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-surface-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-strong)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface-muted)';
                      }}
                    >
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        style={{ display: 'none' }}
                      />
                      <UploadIcon width={32} height={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Upload Photo
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        PNG, JPG up to 2MB (will be compressed)
                      </span>
                    </label>
                  )}
                </div>

                {/* Project Name */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Project Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Hospital West Project"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                    }}
                  />
                </div>

                {/* Location */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    placeholder="e.g., London, UK"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                    }}
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={projectStartDate}
                    onChange={(e) => setProjectStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Add a description for this project..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleCloseEditModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmitUpdate}
                    disabled={!projectName.trim() || isUpdating}
                  >
                    {isUpdating ? 'Updating...' : 'Update Project'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <section className="panel">
        <header className="page-heading">
          <div>
            <h2 className="panel__title">Projects</h2>
            <p className="panel__subtitle">
              Select an existing project or create a new one to manage drawings, schedules, and tables.
            </p>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenModal}
            >
              <PlusIcon width={16} height={16} style={{ marginRight: 8 }} />
              Create New Project
            </button>
          </div>
        </header>

        {projects.length === 0 ? (
          <div
            style={{
              padding: '100px 40px',
              textAlign: 'center',
              border: '2px dashed var(--border-strong)',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-surface-muted)',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'var(--accent-soft)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
              }}
            >
              <FolderIcon width={40} height={40} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
              No projects yet
            </h3>
            <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              Create your first project to start managing drawings, schedules, and tables.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleOpenModal}>
              <PlusIcon width={16} height={16} style={{ marginRight: 8 }} />
              Create New Project
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '24px',
            }}
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onSelect={onSelectProject}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string, e: React.MouseEvent) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect, onEdit, onDelete }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onEdit(project);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onDelete(project.id, e);
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
        position: 'relative',
      }}
      onClick={() => onSelect(project)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Action Buttons */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          gap: '8px',
          zIndex: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleEditClick}
          style={{
            background: 'var(--bg-surface)',
            border: 'none',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface-muted)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Edit project"
        >
          <EditIcon width={18} height={18} />
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          style={{
            background: 'var(--bg-surface)',
            border: 'none',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--danger)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface-muted)';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.color = 'var(--danger-strong)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface)';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = 'var(--danger)';
          }}
          title="Delete project"
        >
          <TrashIcon width={18} height={18} />
        </button>
      </div>

      {/* Photo Header */}
      <div style={{ padding: '24px 24px 16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {project.photo ? (
          <div
            style={{
              width: '100%',
              height: '270px',
              backgroundImage: `url(${project.photo})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
              borderRadius: '12px',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '270px',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-strong) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
            }}
          >
            <FolderIcon width={64} height={64} style={{ color: 'rgba(255, 255, 255, 0.9)' }} />
          </div>
        )}
        <h3
          style={{
            margin: '0',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            textAlign: 'center',
          }}
        >
          {project.name}
        </h3>
      </div>

      <div style={{ padding: '0 24px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          {project.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <BuildingIcon width={14} height={14} />
              <span>{project.location}</span>
            </div>
          )}
          {project.description && (
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {project.description}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-soft)',
            fontSize: '13px',
            color: 'var(--text-tertiary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DrawingIcon width={16} height={16} />
            <span>Drawings</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TableIcon width={16} height={16} />
            <span>Schedules</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ListIcon width={16} height={16} />
            <span>Tables</span>
          </div>
        </div>

        {project.startDate && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-soft)',
            }}
          >
            Started {formatDate(project.startDate)}
          </div>
        )}
      </div>
    </div>
  );
};
