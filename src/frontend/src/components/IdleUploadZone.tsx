import React, {useState, useRef} from 'react';

interface IdleUploadZoneProps {
    onFileDrop: (file: File) => void;
}

export const IdleUploadZone: React.FC<IdleUploadZoneProps> = ({onFileDrop}) => {
    const [isDragging, setIsDragging] = useState<Boolean>(false);
    const [localError, setLocalError] = useState<string|null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileValidation = (file: File) => {
        setLocalError(null);

        if (file.type !== 'application/pdf'){
            setLocalError('Validation error: Invalid file format. Only raw PDF binaries are accepted!');
            return;
        }

        if (file.size > 10*1024*1024){
            setLocalError("Validation error: File size boundary limits exceed 10MB!");
            return;
        }
        onFileDrop(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }

    const handleDragLeave = () => {
        setIsDragging(false);
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]){
            handleFileValidation(e.dataTransfer.files[0]);
        }
    }

    return (
      <div className="idle-upload-page">
        {/* PANEL TRÁI: DROP ZONE CHỨA FILE */}
        <div className="left-panel-idle">
          <div
            className={`drop-zone ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              className="upload-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>

            <p className="upload-text">
              Drag and drop engineering candidate PDF resume here to ingest
            </p>
            <small className="upload-hint">
              Max 10 MB • System standard PDF fields only
            </small>
            <span className="divider-text">or</span>
            <button className="browse-btn">Browse Files</button>

            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              hidden
              onChange={(e) =>
                e.target.files && handleFileValidation(e.target.files[0])
              }
            />
          </div>
          {localError && (
            <div className="local-validation-error">{localError}</div>
          )}
        </div>

        <div className="right-panel-placeholder">
          <div className="mock-blur-overlay">
            <span className="lock-text">Awaiting Ingestion Stream Data...</span>
          </div>
        </div>
      </div>
    );
}