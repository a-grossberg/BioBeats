import { TIFFFrame } from './utils/tiffLoader';

export interface Neuron {
  id: number;
  name: string;
  trace: number[];
  coordinates?: number[][];
  frequency?: number;
  phase?: number;
  amplitude?: number;
  baseline?: number;
}

export interface CalciumDataset {
  neurons: Neuron[];
  frames: number;
  fps: number;
  datasetName?: string;
  imageWidth?: number; // Original image width in pixels
  imageHeight?: number; // Original image height in pixels
  frameImages?: TIFFFrame[]; // Optional: original frame images for visualization
  metadata?: {
    source?: string;
    region?: string;
    condition?: 'control' | 'disease' | 'unknown';
    description?: string;
  };
}

export interface FrameData {
  frameIndex: number;
  imageData: ImageData | null;
  timestamp: number;
}

