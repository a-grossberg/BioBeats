import { CalciumDataset, Neuron } from '../types';

/**
 * Aligns neurons from two datasets by matching their IDs or indices
 */
function alignNeurons(neurons1: Neuron[], neurons2: Neuron[]): Array<{ n1: Neuron | null; n2: Neuron | null; index: number }> {
  const aligned: Array<{ n1: Neuron | null; n2: Neuron | null; index: number }> = [];
  const maxLength = Math.max(neurons1.length, neurons2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const n1 = i < neurons1.length ? neurons1[i] : null;
    const n2 = i < neurons2.length ? neurons2[i] : null;
    aligned.push({ n1, n2, index: i });
  }
  
  return aligned;
}

/**
 * Aligns traces to the same length by padding with zeros or truncating
 */
function alignTraces(trace1: number[], trace2: number[]): [number[], number[]] {
  const maxLength = Math.max(trace1.length, trace2.length);
  const aligned1 = [...trace1];
  const aligned2 = [...trace2];
  
  // Pad with zeros if needed
  while (aligned1.length < maxLength) {
    aligned1.push(0);
  }
  while (aligned2.length < maxLength) {
    aligned2.push(0);
  }
  
  return [aligned1, aligned2];
}

/**
 * Adds two datasets together by adding corresponding neuron traces
 */
export function addDatasets(dataset1: CalciumDataset, dataset2: CalciumDataset): CalciumDataset {
  const aligned = alignNeurons(dataset1.neurons, dataset2.neurons);
  const frames = Math.max(dataset1.frames, dataset2.frames);
  const fps = dataset1.fps || dataset2.fps || 10;
  
  const resultNeurons: Neuron[] = [];
  
  aligned.forEach(({ n1, n2, index }) => {
    if (!n1 && !n2) return;
    
    const [trace1, trace2] = n1 && n2 
      ? alignTraces(n1.trace, n2.trace)
      : n1 
        ? [n1.trace, new Array(n1.trace.length).fill(0)]
        : [new Array(n2!.trace.length).fill(0), n2!.trace];
    
    const resultTrace = trace1.map((val, i) => val + trace2[i]);
    
    resultNeurons.push({
      id: index,
      name: n1?.name || n2?.name || `neuron_${index}`,
      trace: resultTrace,
      coordinates: n1?.coordinates || n2?.coordinates,
    });
  });
  
  return {
    neurons: resultNeurons,
    frames,
    fps,
    datasetName: `${dataset1.datasetName || 'Dataset1'} + ${dataset2.datasetName || 'Dataset2'}`,
    imageWidth: dataset1.imageWidth || dataset2.imageWidth,
    imageHeight: dataset1.imageHeight || dataset2.imageHeight,
    metadata: {
      source: 'operation',
      description: `Sum of ${dataset1.datasetName || 'Dataset1'} and ${dataset2.datasetName || 'Dataset2'}`,
    },
  };
}

/**
 * Subtracts dataset2 from dataset1 by subtracting corresponding neuron traces
 */
export function subtractDatasets(dataset1: CalciumDataset, dataset2: CalciumDataset): CalciumDataset {
  const aligned = alignNeurons(dataset1.neurons, dataset2.neurons);
  const frames = Math.max(dataset1.frames, dataset2.frames);
  const fps = dataset1.fps || dataset2.fps || 10;
  
  const resultNeurons: Neuron[] = [];
  
  aligned.forEach(({ n1, n2, index }) => {
    if (!n1 && !n2) return;
    
    const [trace1, trace2] = n1 && n2 
      ? alignTraces(n1.trace, n2.trace)
      : n1 
        ? [n1.trace, new Array(n1.trace.length).fill(0)]
        : [new Array(n2!.trace.length).fill(0), n2!.trace];
    
    const resultTrace = trace1.map((val, i) => val - trace2[i]);
    
    resultNeurons.push({
      id: index,
      name: n1?.name || n2?.name || `neuron_${index}`,
      trace: resultTrace,
      coordinates: n1?.coordinates || n2?.coordinates,
    });
  });
  
  return {
    neurons: resultNeurons,
    frames,
    fps,
    datasetName: `${dataset1.datasetName || 'Dataset1'} - ${dataset2.datasetName || 'Dataset2'}`,
    imageWidth: dataset1.imageWidth || dataset2.imageWidth,
    imageHeight: dataset1.imageHeight || dataset2.imageHeight,
    metadata: {
      source: 'operation',
      description: `Difference of ${dataset1.datasetName || 'Dataset1'} and ${dataset2.datasetName || 'Dataset2'}`,
    },
  };
}

/**
 * Averages two datasets by averaging corresponding neuron traces
 */
export function averageDatasets(dataset1: CalciumDataset, dataset2: CalciumDataset): CalciumDataset {
  const aligned = alignNeurons(dataset1.neurons, dataset2.neurons);
  const frames = Math.max(dataset1.frames, dataset2.frames);
  const fps = dataset1.fps || dataset2.fps || 10;
  
  const resultNeurons: Neuron[] = [];
  
  aligned.forEach(({ n1, n2, index }) => {
    if (!n1 && !n2) return;
    
    const [trace1, trace2] = n1 && n2 
      ? alignTraces(n1.trace, n2.trace)
      : n1 
        ? [n1.trace, new Array(n1.trace.length).fill(0)]
        : [new Array(n2!.trace.length).fill(0), n2!.trace];
    
    const resultTrace = trace1.map((val, i) => (val + trace2[i]) / 2);
    
    resultNeurons.push({
      id: index,
      name: n1?.name || n2?.name || `neuron_${index}`,
      trace: resultTrace,
      coordinates: n1?.coordinates || n2?.coordinates,
    });
  });
  
  return {
    neurons: resultNeurons,
    frames,
    fps,
    datasetName: `Average of ${dataset1.datasetName || 'Dataset1'} and ${dataset2.datasetName || 'Dataset2'}`,
    imageWidth: dataset1.imageWidth || dataset2.imageWidth,
    imageHeight: dataset1.imageHeight || dataset2.imageHeight,
    metadata: {
      source: 'operation',
      description: `Average of ${dataset1.datasetName || 'Dataset1'} and ${dataset2.datasetName || 'Dataset2'}`,
    },
  };
}
