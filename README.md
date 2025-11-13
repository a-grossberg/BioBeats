# BioBeats - Calcium Imaging Sonification

An interactive web application that translates calcium imaging data into sound and music, exploring the relationship between biological oscillations and human aesthetic experience. Experience your neural data as a jukebox of biological rhythms.

## Features

- **Real Data Integration**: Loads actual Neurofinder calcium imaging datasets (TIFF sequences)
- **Interactive Sonification**: Each neuron is mapped to a musical note, with calcium intensity controlling volume
- **Jukebox Interface**: Retro-inspired UI with neon effects and intuitive controls
- **Multiple Visualization Modes**:
  - Individual calcium traces over time
  - Network activity heatmap
  - Population-level activity timeline
  - Brain visualization with cluster coloring
- **Dataset Comparison**: Compare multiple datasets side-by-side (e.g., disease vs. control, different brain regions)
- **Real-time Playback**: Adjustable tempo, volume, and sonification modes (spike-triggered or continuous)
- **Musical & Spike Modes**: Choose between musical sonification or spike-based audio representation

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install
```

### Live Demo

The app is deployed on GitHub Pages at: `https://a-grossberg.github.io/BioBeats/`

**Note**: For full functionality with all datasets, you'll need to prepare dataset files (see GITHUB_PAGES_SETUP.md). The app works with sample datasets that are included in the repository.

### Running the Application

**Option 1: Development with Local Proxy** (for full dataset access):
1. **Terminal 1 - Proxy Server**:
   ```bash
   npm run proxy
   ```
   This runs the proxy server on port 3001 to fetch datasets from S3.

2. **Terminal 2 - Development Server**:
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:3000`

**Option 2: Development with GitHub Pages** (simpler, uses pre-loaded datasets):
```bash
npm run dev
```
The app will try to load datasets from GitHub Pages. If datasets aren't available, it will fall back to the proxy if running.

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
   - Browse the available datasets in the selector (A1-A20 slots)
   - Click on a dataset card to load it
   - The app will automatically download and process the data
   - You'll see a progress indicator during loading

2. **Explore**:
   - Click play to hear the sonification
   - Adjust tempo and volume controls
   - Switch between spike and musical sonification modes
   - Load multiple datasets to compare them
   - Use the VIEW toggle to switch between single and compare modes

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

1. **TIFF Loading**: Reads TIFF image sequences using the `geotiff` library (server-side processing)
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
  - **Musical Mode**: Continuous musical sonification with harmonies and rhythms

## Technical Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tone.js** for audio synthesis
- **geotiff** for TIFF image parsing
- **Tailwind CSS** for styling
- **lucide-react** for icons
- **Express** for proxy server

## Data Handling

Large `.tiff` files are excluded from version control (see `.gitignore`). Datasets are:
- Downloaded on-demand from S3 via the proxy server
- Cached locally in `data/cache/` (excluded from git)
- Pre-loadable using `npm run preload`

See [DATA_HANDLING.md](./DATA_HANDLING.md) for more details on managing data files.

## Dataset Sources

Datasets are from the [Neurofinder Benchmark](https://github.com/codeneuro/neurofinder), provided by:

- Simon Peron, Nicholas Sofroniew, & Karel Svoboda / Janelia Research Campus
- Adam Packer, Lloyd Russell & Michael Häusser / UCL
- Jeff Zaremba, Patrick Kaifosh & Attila Losonczy / Columbia
- Selmaan Chettih, Matthias Minderer, Chris Harvey / Harvard

## Project Structure

```
BioBeats/
├── src/
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   └── types.ts          # TypeScript type definitions
├── server/               # Proxy server for data access
├── public/               # Static assets
└── data/                 # Dataset cache (excluded from git)
```

## Deployment

### Netlify (Recommended)

The app is configured for Netlify deployment with serverless functions that replace the proxy server.

**Quick Deploy:**

1. **Via Netlify UI**:
   - Go to [netlify.com](https://netlify.com) and sign in with GitHub
   - Click "Add new site" → "Import an existing project"
   - Select your `a-grossberg/BioBeats` repository
   - Build settings are auto-detected from `netlify.toml`
   - Click "Deploy site"

2. **Via Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod
   ```

**How it works:**
- Netlify serves the static React app
- Netlify Functions (`netlify/functions/neurofinder.js`) handle dataset API requests
- No separate proxy server needed - everything works out of the box!

See [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) for detailed instructions and troubleshooting.

## Future Enhancements

- [ ] Export audio files
- [ ] Advanced ROI detection algorithms
- [ ] Support for additional calcium imaging formats
- [ ] Real-time streaming from imaging systems
- [ ] Additional visualization modes
- [ ] Deploy proxy server for production dataset access

## License

CC0-1.0

## Acknowledgments

Built for exploring the intersection of neuroscience, data visualization, and music. Inspired by the oscillatory patterns of living neural networks and the aesthetic experience of biological rhythms.
