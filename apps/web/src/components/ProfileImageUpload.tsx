"use client";

import { useState, useRef } from "react";
import { ImageCropper } from "./ImageCropper";

interface ProfileImageUploadProps {
  currentImage: string | null;
  onUpload: (data: string, fileType: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ProfileImageUpload({
  currentImage,
  onUpload,
  onDelete,
}: ProfileImageUploadProps) {
  const [_file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [error, setError] = useState("");
  const [_uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFormats = ".jpg,.jpeg,.gif,.png";
  const acceptedMimeTypes = ["image/jpeg", "image/jpg", "image/gif", "image/png"];

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedMimeTypes.includes(file.type)) {
      return `Invalid file type. Please use ${acceptedFormats} files.`;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return "File size must be less than 10MB.";
    }

    return null;
  };

  const handleFileSelect = async (selectedFile: File) => {
    setError("");
    setFile(null);
    setPreview(null);

    // Validate file
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFile(selectedFile);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setShowCropper(true);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleCrop = async (croppedDataUrl: string) => {
    setUploading(true);
    setError("");

    try {
      // Extract mime type from data URL (format: data:image/png;base64,...)
      const mimeTypeMatch = croppedDataUrl.match(/data:image\/(png|jpeg|gif);base64,/);
      const mimeType = mimeTypeMatch ? `image/${mimeTypeMatch[1]}` : "image/png";
      
      await onUpload(croppedDataUrl, mimeType);
      setShowCropper(false);
      setPreview(null);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleCancelCrop = () => {
    setShowCropper(false);
    setPreview(null);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete your profile picture?")) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await onDelete();
    } catch (err: any) {
      setError(err.message || "Failed to delete image");
    } finally {
      setDeleting(false);
    }
  };

  // Show cropper if we have a preview
  if (showCropper && preview) {
    return (
      <div className="space-y-4">
        <ImageCropper
          imageSrc={preview}
          onCrop={handleCrop}
          onCancel={handleCancelCrop}
          type="profile"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Show current image if it exists
  if (currentImage && !showCropper) {
    return (
      <div className="space-y-4">
        <div className="border border-border-primary rounded-lg p-4 bg-background-secondary">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <img
                src={currentImage}
                alt="Profile"
                className="w-32 h-32 object-cover rounded-full border border-border-primary"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary mb-1">
                Profile Picture
              </div>
              <div className="text-xs text-text-secondary mb-4">
                256×256px
              </div>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Show upload container
  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-border-primary rounded-lg p-6 text-center hover:border-border-secondary transition-colors cursor-pointer bg-background-secondary"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats}
          onChange={handleFileInputChange}
          className="hidden"
        />
        <svg
          className="mx-auto h-12 w-12 text-text-secondary mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm text-text-primary font-medium mb-1">
          Click to upload or drag and drop
        </p>
        <p className="text-xs text-text-secondary">
          {acceptedFormats} (max 10MB)
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

