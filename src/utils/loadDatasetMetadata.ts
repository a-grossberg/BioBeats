/**
 * Load and merge dataset metadata from ZIP files
 * This ensures we display accurate information from the actual datasets
 */

import { DatasetInfo } from './datasetLoader';

export interface DatasetMetadata {
  lab?: string;
  source?: string;
  contributor?: string;
  location?: string;
  institution?: string;
  region?: string;
  brain_region?: string;
  organism?: string;
  species?: string;
  indicator?: string;
  fluorophore?: string;
  rateHz?: number;
  fps?: number;
  frequency?: number;
  frameCount?: number;
  dimensions?: number[];
  [key: string]: any; // Allow other metadata fields
}

/**
 * Merge metadata from ZIP file with hardcoded dataset info
 * Metadata from ZIP takes precedence over hardcoded values
 */
export function mergeDatasetMetadata(
  datasetInfo: DatasetInfo,
  metadata: DatasetMetadata | null
): DatasetInfo {
  if (!metadata) {
    return datasetInfo;
  }

  return {
    ...datasetInfo,
    // Lab/source info - prefer metadata
    lab: metadata.lab || metadata.source?.split('/').pop()?.trim() || datasetInfo.lab,
    source: metadata.source || metadata.contributor || datasetInfo.source,
    location: metadata.location || metadata.institution || datasetInfo.location,
    // Institution - extract from location or use institution field
    institution: metadata.institution || metadata.location || datasetInfo.location,
    
    // Scientific info
    region: metadata.region || metadata.brain_region || datasetInfo.region,
    organism: metadata.organism || metadata.species || datasetInfo.organism,
    indicator: metadata.indicator || metadata.fluorophore || datasetInfo.indicator,
    
    // Technical info
    rateHz: metadata.rateHz || metadata.fps || metadata.frequency || datasetInfo.rateHz,
    frameCount: metadata.frameCount || datasetInfo.frameCount,
    dimensions: metadata.dimensions || datasetInfo.dimensions,
  };
}

