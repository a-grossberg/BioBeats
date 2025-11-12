# Wavelet - Calcium Imaging Sonification

An interactive web application that translates calcium imaging data into sound and music, exploring the relationship between biological oscillations and human aesthetic experience.

## Features

- **Real Data Integration**: Loads actual Neurofinder calcium imaging datasets (TIFF sequences)
- **Interactive Sonification**: Each neuron is mapped to a musical note, with calcium intensity controlling volume
- **Multiple Visualization Modes**:
  - Individual calcium traces over time
  - Network activity heatmap
  - Population-level activity timeline
- **Dataset Comparison**: Compare multiple datasets side-by-side (e.g., disease vs. control, different brain regions)
- **Real-time Playback**: Adjustable tempo, volume, and sonification modes (spike-triggered or continuous)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install
```

### Running the Application

**Important:** You need TWO terminals running:

1. **Terminal 1 - Proxy Server** (required):
   ```bash
   npm run proxy
   ```
   This must be running for the app to access datasets.

2. **Terminal 2 - Development Server**:
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:3000`

### Pre-loading Datasets (Recommended)

Before using the app, pre-load datasets to avoid slow on-demand downloads:

```bash
# Pre-load a specific dataset
npm run preload 00.00

# Or pre-load all datasets (takes a while - ~20GB)
npm run preload:all
```

Once pre-loaded, datasets load instantly from cache!

### Building for Production

```bash
npm run build
npm run preview
```

## Using the Application

### Setting Up Data Access

**Recommended: Pre-load Datasets (Fastest)**

Pre-download and cache datasets before using the app:

```bash
# Pre-load a specific dataset
npm run preload 00.00

# Or pre-load all datasets (this will take a while - ~20GB total)
npm run preload:all
```

This downloads and extracts datasets to `data/cache/` so they're ready instantly when you use the app.

**Option 2: On-Demand Download (Slower)**

The app can download datasets on-demand, but this is slow (1GB+ per dataset):

1. Start the proxy server:
   ```bash
   npm run proxy
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. Select a dataset - it will download automatically (may take several minutes)

**Option 3: Manual Download**

1. Download from: https://s3.amazonaws.com/neuro.datasets/challenges/neurofinder/neurofinder.{id}.zip
2. Place ZIP in `data/cache/{id}.zip` or extract to `data/cache/{id}/`
3. The proxy will use cached files automatically

### Loading Datasets

1. **Select a Dataset**:
   - Browse the available datasets in the selector
   - Click on a dataset card to load it
   - The app will automatically download and process the data

2. **Explore**:
   - Click play to hear the sonification
   - Adjust tempo and volume controls
   - Switch between spike and continuous sonification modes
   - Load multiple datasets to compare them

### Dataset Format

The application expects:
- **TIFF Files**: Image sequence files named with frame numbers (e.g., `frame_000.tif`, `frame_001.tif`, or `000.tif`, `001.tif`)
- **Regions JSON** (optional): Ground truth neuron coordinates in Neurofinder format:
  ```json
  [
    {"coordinates": [[x1, y1], [x2, y2], ...]},
    {"coordinates": [[x1, y1], [x2, y2], ...]},
    ...
  ]
  ```

If no regions file is provided, the app will auto-detect neurons using variance-based peak detection.

## How It Works

### Data Processing Pipeline

1. **TIFF Loading**: Reads TIFF image sequences using the `geotiff` library
2. **ROI Extraction**: 
   - Uses ground truth regions if available
   - Otherwise auto-detects neurons by finding high-variance pixels
3. **Trace Extraction**: Samples pixel intensities within each ROI across all frames
4. **Normalization**: Subtracts baseline and normalizes traces to 0-1 range
5. **Sonification**: Maps each neuron to a pentatonic scale note, with intensity controlling volume

### Sonification Mapping

- **Pitch**: Each neuron is assigned a note from a pentatonic scale (C major pentatonic)
- **Volume**: Calcium intensity (0-1) maps to -40dB to 0dB
- **Timing**: Frame rate determines note timing (adjustable via tempo control)
- **Modes**:
  - **Spike Mode**: Triggers notes on rising edges (when intensity crosses threshold)
  - **Continuous Mode**: Sustains notes while intensity is above threshold

## Technical Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tone.js** for audio synthesis
- **geotiff** for TIFF image parsing
- **Tailwind CSS** for styling
- **lucide-react** for icons

## Dataset Sources

Datasets are from the [Neurofinder Benchmark](https://github.com/codeneuro/neurofinder), provided by:

- Simon Peron, Nicholas Sofroniew, & Karel Svoboda / Janelia Research Campus
- Adam Packer, Lloyd Russell & Michael Häusser / UCL
- Jeff Zaremba, Patrick Kaifosh & Attila Losonczy / Columbia
- Selmaan Chettih, Matthias Minderer, Chris Harvey / Harvard

## Future Enhancements

- [ ] AI music generation integration (MusicGen, Magenta)
- [ ] Export audio files
- [ ] 3D visualization of network activity
- [ ] Advanced ROI detection algorithms
- [ ] Support for additional calcium imaging formats
- [ ] Real-time streaming from imaging systems

## License

MIT

## Acknowledgments

Built for exploring the intersection of neuroscience, data visualization, and music. Inspired by the oscillatory patterns of living neural networks.

