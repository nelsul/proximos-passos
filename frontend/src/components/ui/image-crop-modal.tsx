"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { getCroppedImage } from "@/lib/crop-image";

interface ImageCropModalProps {
  /** Object URL of the image to crop */
  imageSrc: string;
  /** Desired aspect ratio, e.g. 1 for avatars, 16/9 for thumbnails */
  aspectRatio: number;
  /** Max output width in pixels */
  maxWidth?: number;
  /** Called with the resulting WebP File when the user confirms */
  onCropComplete: (file: File) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

export function ImageCropModal({
  imageSrc,
  aspectRatio,
  maxWidth = 800,
  onCropComplete,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const file = await getCroppedImage(imageSrc, croppedAreaPixels, maxWidth);
      onCropComplete(file);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80">
      {/* Cropper area */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 bg-black/90 px-6 py-5">
        {/* Zoom slider */}
        <div className="flex w-full max-w-sm items-center gap-3">
          <span className="text-xs text-white/60">–</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-[#cfa156]"
          />
          <span className="text-xs text-white/60">+</span>
        </div>

        {/* Action buttons */}
        <div className="flex w-full max-w-sm gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="flex-1 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing || !croppedAreaPixels}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: processing ? "#a07a3a" : "#cfa156" }}
          >
            {processing ? "Processing…" : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
