import type { Area } from "react-easy-crop";

/**
 * Loads an image from a URL and returns an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Crops and resizes an image using a canvas, returning a WebP File.
 *
 * @param imageSrc  - Object URL or data URL of the source image
 * @param pixelCrop - The pixel crop area returned by react-easy-crop
 * @param maxWidth  - Max width of the output (height is derived from aspect ratio)
 * @param fileName  - Name for the resulting File object
 */
export async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
  maxWidth = 800,
  fileName = "cropped.webp",
): Promise<File> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Scale output so it doesn't exceed maxWidth while preserving crop aspect ratio
  const aspectRatio = pixelCrop.width / pixelCrop.height;
  const outputWidth = Math.min(pixelCrop.width, maxWidth);
  const outputHeight = Math.round(outputWidth / aspectRatio);

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob returned null"));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/webp" }));
      },
      "image/webp",
      0.8,
    );
  });
}
