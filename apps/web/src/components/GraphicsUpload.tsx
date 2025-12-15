"use client";

import { useState, useRef } from "react";
import { ImageCropper } from "./ImageCropper";

interface GraphicsUploadProps {
  type: "logo" | "banner";
  currentImage: string | null;
  currentFileName: string | null;
  onUpload: (data: string, fileName: string, fileType: string) => Promise<void>;
  onDelete: () => Promise<void>;
  projectId: string;
}

export function GraphicsUpload({
  type,
  currentImage,
  currentFileName,
  onUpload,
  onDelete,
  projectId: _projectId,
}: GraphicsUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLogo = type === "logo";
  const acceptedFormats = isLogo ? ".jpg,.jpeg,.gif,.svg,.png" : ".jpg,.jpeg,.png";
  const acceptedMimeTypes = isLogo
    ? ["image/jpeg", "image/jpg", "image/gif", "image/svg+xml", "image/png"]
    : ["image/jpeg", "image/jpg", "image/png"];
  const maxWidth = isLogo ? 500 : 2000;
  const maxHeight = isLogo ? 500 : 2000;
  const recommendedFormat = isLogo ? "PNG" : "PNG or JPG";

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

  const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  const validateImageDimensions = async (file: File): Promise<string | null> => {
    if (file.type === "image/svg+xml") {
      // SVG doesn't have fixed dimensions, skip validation
      return null;
    }

    try {
      const img = await loadImage(file);
      if (img.width > maxWidth || img.height > maxHeight) {
        return `Image dimensions (${img.width}×${img.height}) exceed maximum allowed (${maxWidth}×${maxHeight}px).`;
      }
      return null;
    } catch (err) {
      return "Failed to load image for validation.";
    }
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

    // Validate dimensions
    const dimensionError = await validateImageDimensions(selectedFile);
    if (dimensionError) {
      setError(dimensionError);
      return;
    }

    setFile(selectedFile);

    // For SVG, skip cropping and upload directly
    if (selectedFile.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        try {
          setUploading(true);
          await onUpload(dataUrl, selectedFile.name, selectedFile.type);
          setFile(null);
          setPreview(null);
        } catch (err: any) {
          setError(err.message || "Failed to upload image");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(selectedFile);
      return;
    }

    // For bitmaps, show preview and cropper
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleCrop = async (croppedDataUrl: string) => {
    if (!file) return;

    try {
      setUploading(true);
      setError("");
      
      // Validate that we have valid image data
      if (!croppedDataUrl || croppedDataUrl.length === 0) {
        throw new Error("No image data to upload");
      }
      
      await onUpload(croppedDataUrl, file.name, file.type);
      setShowCropper(false);
      setFile(null);
      setPreview(null);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to upload image";
      setError(errorMessage);
      console.error("Image upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelCrop = () => {
    setShowCropper(false);
    setFile(null);
    setPreview(null);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the ${type}?`)) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
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
          type={type}
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
                alt={type}
                className={`border border-border-primary rounded ${
                  isLogo ? "w-32 h-32 object-contain" : "w-full max-w-md h-32 object-cover"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary mb-1">
                {currentFileName || `${type}.${currentImage.includes("svg") ? "svg" : "png"}`}
              </div>
              <div className="text-xs text-text-secondary mb-4">
                {isLogo ? "Logo image" : "Banner image"}
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
        className="relative border-2 border-dashed border-border-primary rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer"
        onMouseDown={(e) => {
          // Prevent blur on other inputs when clicking file container
          e.preventDefault();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats}
          onChange={handleFileInputChange}
          className="hidden"
        />
        {uploading ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <div className="text-sm text-text-primary">
              <span className="font-medium">Uploading...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-text-tertiary"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-sm text-text-primary">
              <span className="font-medium">Drag and drop a file here, or click to choose a file</span>
            </div>
            <p className="text-xs text-text-secondary">
              {acceptedFormats.toUpperCase()} files only (max {maxWidth}×{maxHeight}px)
            </p>
            {isLogo && (
              <p className="text-xs text-primary-600 font-medium mt-1">
                Recommended: {recommendedFormat} format
              </p>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
