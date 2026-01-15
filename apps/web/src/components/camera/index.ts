// Camera components for photo capture and management
export { CameraCapture } from "./CameraCapture";
export { PhotoPreview } from "./PhotoPreview";
export { PhotoGallery } from "./PhotoGallery";
export { CameraPermissions } from "./CameraPermissions";

// Type exports for camera integration
export type {
  // Basic types
  AgeGroup,
  PhotoFormat,
  PhotoQuality,
  CameraCaptureState,
  CameraType,

  // Data structures
  PhotoMetadata,

  // Component props
  CameraCaptureProps,
  PhotoPreviewProps,
  PhotoGalleryProps,
} from "./CameraCapture";
