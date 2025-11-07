import React, { useState, useCallback } from 'react';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (files[0].type === 'text/csv') {
        onFileSelect(files[0]);
      } else {
        alert('Please upload a valid .csv file.');
      }
    }
  }, [onFileSelect, disabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    document.getElementById('file-input')?.click();
  };
  
  const dropzoneClasses = [
    'dropzone',
    isDragging ? 'dropzone--active' : '',
    disabled ? 'dropzone--disabled' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <h2 className="panel__title">Upload your BIM schedule</h2>
      <p className="panel__subtitle">
        Drop a CSV export from your BIM model. Our AI will read headers, suggest aligned naming, and prepare NRM-ready groupings in minutes.
      </p>
      <div
        className={dropzoneClasses}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept=".csv"
          onChange={handleFileChange}
          disabled={disabled}
        />
        <UploadIcon className="dropzone__icon" />
        <div className="dropzone__title">
          {disabled ? 'Processing...' : 'Click to upload or drag your file' }
        </div>
        <p className="muted">
          CSV files only · <span className="link-cta">View template</span>
        </p>
        <p className="dropzone__hint">Tip: include element IDs, quantities, and disciplines for best grouping quality.</p>
      </div>
    </div>
  );
};