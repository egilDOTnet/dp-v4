"use client";

import { useState, useRef } from "react";
import { ImageCropper } from "./ImageCropper";
import { generateRandomBanner } from "@/lib/banner-generator";

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
  const [generating, setGenerating] = useState(false);
  const [color1, setColor1] = useState("#65d405");
  const [color2, setColor2] = useState("#0891b2");
  const [color3, setColor3] = useState("#ffcf33");
  const [useRandomColor1, setUseRandomColor1] = useState(false);
  const [useRandomColor2, setUseRandomColor2] = useState(false);
  const [useRandomColor3, setUseRandomColor3] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLogo = type === "logo";
  const acceptedFormats = isLogo ? ".jpg,.jpeg,.gif,.svg,.png" : ".jpg,.jpeg,.svg,.png";
  const acceptedMimeTypes = isLogo
    ? ["image/jpeg", "image/jpg", "image/gif", "image/svg+xml", "image/png"]
    : ["image/jpeg", "image/jpg", "image/svg+xml", "image/png"];
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
    } catch {
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

  /**
   * Converts a data URL to a File object
   */
  const dataURLtoFile = (dataUrl: string, filename: string, mimeType: string): File => {
    // Handle SVG data URLs (they use URI encoding, not base64)
    if (dataUrl.startsWith('data:image/svg+xml')) {
      const svgContent = decodeURIComponent(dataUrl.split(',')[1] || '');
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      return new File([blob], filename, { type: 'image/svg+xml' });
    }
    
    // Handle base64 encoded images (PNG, JPEG, etc.)
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  /**
   * Handles random banner generation
   */
  const handleGenerateBanner = async () => {
    if (isLogo) return; // Only for banners
    
    setError("");
    setGenerating(true);
    
    try {
      const finalColor1 = useRandomColor1 ? null : color1;
      const finalColor2 = useRandomColor2 ? null : color2;
      const finalColor3 = useRandomColor3 ? null : color3;
      
      // Generate as PNG so it can go through cropping flow
      const dataUrl = await generateRandomBanner(finalColor1, finalColor2, finalColor3, maxWidth, maxHeight, 'png');
      
      // Create a synthetic File object for the generated banner
      const generatedFile = dataURLtoFile(dataUrl, `banner-${Date.now()}.png`, "image/png");
      
      // Set file and preview, then show cropper (same as uploaded PNG files)
      setFile(generatedFile);
      setPreview(dataUrl);
      setShowCropper(true);
    } catch (err: any) {
      setError(err.message || "Failed to generate banner");
    } finally {
      setGenerating(false);
    }
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
      {/* Random Banner Generator - Only for banners */}
      {!isLogo && (
        <div className="border border-border-primary rounded-lg p-4 bg-background-secondary">
          <div className="space-y-4">
            <div className="text-sm font-medium text-text-primary">
              Create Random Abstract Banner
            </div>
            <div className="text-xs text-text-secondary mb-3">
              Generate a unique abstract banner with flowing curves and organic shapes
            </div>
            
            {/* Color Pickers */}
            <div className="grid grid-cols-3 gap-4">
              {/* Color 1 */}
              <div className="space-y-2">
                <label className="text-xs text-text-secondary">Color 1</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useRandomColor1}
                    onChange={(e) => setUseRandomColor1(e.target.checked)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-xs text-text-secondary">Random</span>
                </div>
                {!useRandomColor1 && (
                  <input
                    type="color"
                    value={color1}
                    onChange={(e) => setColor1(e.target.value)}
                    className="w-full h-10 rounded border border-border-primary cursor-pointer"
                    disabled={useRandomColor1}
                  />
                )}
                {useRandomColor1 && (
                  <div className="w-full h-10 rounded border border-border-primary bg-background-tertiary flex items-center justify-center">
                    <span className="text-xs text-text-tertiary">Random</span>
                  </div>
                )}
              </div>
              
              {/* Color 2 */}
              <div className="space-y-2">
                <label className="text-xs text-text-secondary">Color 2</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useRandomColor2}
                    onChange={(e) => setUseRandomColor2(e.target.checked)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-xs text-text-secondary">Random</span>
                </div>
                {!useRandomColor2 && (
                  <input
                    type="color"
                    value={color2}
                    onChange={(e) => setColor2(e.target.value)}
                    className="w-full h-10 rounded border border-border-primary cursor-pointer"
                    disabled={useRandomColor2}
                  />
                )}
                {useRandomColor2 && (
                  <div className="w-full h-10 rounded border border-border-primary bg-background-tertiary flex items-center justify-center">
                    <span className="text-xs text-text-tertiary">Random</span>
                  </div>
                )}
              </div>
              
              {/* Color 3 */}
              <div className="space-y-2">
                <label className="text-xs text-text-secondary">Color 3</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useRandomColor3}
                    onChange={(e) => setUseRandomColor3(e.target.checked)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-xs text-text-secondary">Random</span>
                </div>
                {!useRandomColor3 && (
                  <input
                    type="color"
                    value={color3}
                    onChange={(e) => setColor3(e.target.value)}
                    className="w-full h-10 rounded border border-border-primary cursor-pointer"
                    disabled={useRandomColor3}
                  />
                )}
                {useRandomColor3 && (
                  <div className="w-full h-10 rounded border border-border-primary bg-background-tertiary flex items-center justify-center">
                    <span className="text-xs text-text-tertiary">Random</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Generate Button */}
            <button
              onClick={handleGenerateBanner}
              disabled={generating}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </span>
              ) : (
                "Create Random Banner"
              )}
            </button>
          </div>
        </div>
      )}
      
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





