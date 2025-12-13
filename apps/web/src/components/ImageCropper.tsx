"use client";

import { useState, useRef, useEffect } from "react";

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
  type: "logo" | "banner";
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropper({ imageSrc, onCrop, onCancel, type }: ImageCropperProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isLogo = type === "logo";
  const targetWidth = isLogo ? 500 : 1200;
  const targetHeight = isLogo ? 500 : 300;
  const maxImageWidth = isLogo ? 500 : 2000;
  const maxImageHeight = isLogo ? 500 : 2000;

  // Load image and initialize crop area
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      
      // Calculate initial crop area
      let initialCrop: CropArea;
      
      if (isLogo) {
        // For logo: largest square from center
        const size = Math.min(img.width, img.height);
        initialCrop = {
          x: (img.width - size) / 2,
          y: (img.height - size) / 2,
          width: size,
          height: size,
        };
      } else {
        // For banner: center 1200x300 area (scaled to image dimensions)
        const aspectRatio = img.width / img.height;
        const targetAspectRatio = 1200 / 300; // 4:1
        
        let cropWidth: number;
        let cropHeight: number;
        
        if (aspectRatio > targetAspectRatio) {
          // Image is wider than target aspect ratio
          cropHeight = img.height;
          cropWidth = cropHeight * targetAspectRatio;
        } else {
          // Image is taller than target aspect ratio
          cropWidth = img.width;
          cropHeight = cropWidth / targetAspectRatio;
        }
        
        initialCrop = {
          x: (img.width - cropWidth) / 2,
          y: (img.height - cropHeight) / 2,
          width: cropWidth,
          height: cropHeight,
        };
      }
      
      setCropArea(initialCrop);
    };
    img.src = imageSrc;
  }, [imageSrc, isLogo]);

  // Update preview canvas when crop area changes
  useEffect(() => {
    if (!image || !cropArea || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Draw cropped image resized to target dimensions
    ctx.drawImage(
      image,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      0,
      0,
      targetWidth,
      targetHeight
    );
  }, [image, cropArea, targetWidth, targetHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!cropArea || !image || !imageRef.current) return;
      if (!isDragging && !isResizing) return;
      
      const rect = imageRef.current.getBoundingClientRect();
      const scaleX = image.width / rect.width;
      const scaleY = image.height / rect.height;
      
      const currentX = (e.clientX - rect.left) * scaleX;
      const currentY = (e.clientY - rect.top) * scaleY;
      
      const deltaX = currentX - dragStart.x;
      const deltaY = currentY - dragStart.y;

      if (isDragging) {
        // Move crop area
        let newX = cropArea.x + deltaX;
        let newY = cropArea.y + deltaY;
        
        // Constrain to image bounds
        newX = Math.max(0, Math.min(newX, image.width - cropArea.width));
        newY = Math.max(0, Math.min(newY, image.height - cropArea.height));
        
        setCropArea({ ...cropArea, x: newX, y: newY });
        setDragStart({ x: currentX, y: currentY });
      } else if (isResizing) {
        // Resize crop area (for logo, maintain square; for banner, maintain 4:1 aspect ratio)
        if (isLogo) {
          // Square resize - use the larger delta
          const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY));
          const newSize = Math.max(50, Math.min(cropArea.width + delta, Math.min(image.width, image.height)));
          
          // Keep centered or adjust position
          const newX = Math.max(0, Math.min(cropArea.x - (newSize - cropArea.width) / 2, image.width - newSize));
          const newY = Math.max(0, Math.min(cropArea.y - (newSize - cropArea.height) / 2, image.height - newSize));
          
          setCropArea({ x: newX, y: newY, width: newSize, height: newSize });
        } else {
          // Banner resize - maintain 4:1 aspect ratio
          const aspectRatio = 4; // 1200/300
          const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY * aspectRatio;
          const newWidth = Math.max(200, Math.min(cropArea.width + delta, image.width));
          const newHeight = newWidth / aspectRatio;
          
          if (newHeight <= image.height && newWidth <= image.width) {
            const newX = Math.max(0, Math.min(cropArea.x - (newWidth - cropArea.width) / 2, image.width - newWidth));
            const newY = Math.max(0, Math.min(cropArea.y - (newHeight - cropArea.height) / 2, image.height - newHeight));
            
            setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight });
          }
        }
        setDragStart({ x: currentX, y: currentY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, cropArea, image, dragStart, isLogo]);

  const handleMouseDown = (e: React.MouseEvent, isResizeHandle: boolean = false) => {
    if (!cropArea || !imageRef.current) return;
    
    e.preventDefault();
    setIsDragging(!isResizeHandle);
    setIsResizing(isResizeHandle);
    
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = image!.width / rect.width;
    const scaleY = image!.height / rect.height;
    
    setDragStart({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
  };

  const handleApply = () => {
    if (!canvasRef.current || !image || !cropArea) return;
    
    try {
      // Ensure canvas is ready
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get canvas context");
        return;
      }

      // Redraw to ensure canvas has the latest crop
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Get data URL
      const dataUrl = canvas.toDataURL("image/png", 0.92); // Use 0.92 quality to reduce size slightly
      onCrop(dataUrl);
    } catch (error) {
      console.error("Error generating cropped image:", error);
      onCancel();
    }
  };

  if (!image || !cropArea) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const imageDisplayWidth = 600;
  const imageDisplayHeight = (image.height / image.width) * imageDisplayWidth;
  const cropDisplayX = (cropArea.x / image.width) * imageDisplayWidth;
  const cropDisplayY = (cropArea.y / image.height) * imageDisplayHeight;
  const cropDisplayWidth = (cropArea.width / image.width) * imageDisplayWidth;
  const cropDisplayHeight = (cropArea.height / image.height) * imageDisplayHeight;

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-secondary">
        {isLogo
          ? "Select the square area to use for your logo (will be resized to 500x500)"
          : "Select the area to use for your banner (will be resized to 1200x300)"}
      </div>

      <div className="flex gap-6">
        {/* Image with crop overlay */}
        <div
          ref={containerRef}
          className="relative border border-border-primary rounded-lg overflow-hidden bg-background-secondary"
          style={{ width: imageDisplayWidth, height: imageDisplayHeight }}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop preview"
            className="block"
            style={{ width: imageDisplayWidth, height: imageDisplayHeight, objectFit: "contain" }}
            draggable={false}
          />
          
          {/* Dark overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.5) ${(cropDisplayX / imageDisplayWidth) * 100}%, transparent ${(cropDisplayX / imageDisplayWidth) * 100}%, transparent ${((cropDisplayX + cropDisplayWidth) / imageDisplayWidth) * 100}%, rgba(0,0,0,0.5) ${((cropDisplayX + cropDisplayWidth) / imageDisplayWidth) * 100}%, rgba(0,0,0,0.5) 100%),
                          linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.5) ${(cropDisplayY / imageDisplayHeight) * 100}%, transparent ${(cropDisplayY / imageDisplayHeight) * 100}%, transparent ${((cropDisplayY + cropDisplayHeight) / imageDisplayHeight) * 100}%, rgba(0,0,0,0.5) ${((cropDisplayY + cropDisplayHeight) / imageDisplayHeight) * 100}%, rgba(0,0,0,0.5) 100%)`,
            }}
          />
          
          {/* Crop area border */}
          <div
            className="absolute border-2 border-primary-600 cursor-move"
            style={{
              left: cropDisplayX,
              top: cropDisplayY,
              width: cropDisplayWidth,
              height: cropDisplayHeight,
            }}
            onMouseDown={(e) => handleMouseDown(e, false)}
          >
            {/* Resize handles */}
            {isLogo && (
              <>
                <div
                  className="absolute -top-1 -left-1 w-3 h-3 bg-primary-600 border border-white rounded cursor-nwse-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, true);
                  }}
                />
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-primary-600 border border-white rounded cursor-nesw-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, true);
                  }}
                />
                <div
                  className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary-600 border border-white rounded cursor-nesw-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, true);
                  }}
                />
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary-600 border border-white rounded cursor-nwse-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, true);
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-text-primary">Preview</div>
          <canvas
            ref={canvasRef}
            className="border border-border-primary rounded bg-background-secondary"
            style={{ width: isLogo ? 200 : 400, height: isLogo ? 200 : 100 }}
          />
          <div className="text-xs text-text-secondary">
            {targetWidth} × {targetHeight}px
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border-primary rounded-md hover:bg-background-primary text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
