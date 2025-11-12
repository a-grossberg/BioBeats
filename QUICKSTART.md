# Quick Start Guide

## Installation

```bash
npm install
```

## Running the Application

1. **Start the proxy server** (in one terminal):
   ```bash
   npm run proxy
   ```

2. **Start the development server** (in another terminal):
   ```bash
   npm run dev
   ```

The app will open automatically at `http://localhost:3000`

## Using the App

1. **Select a Dataset**:
   - Browse the available Neurofinder datasets in the selector
   - Click on a dataset card to load it
   - The app will automatically download and process the data
   - You'll see a progress bar during loading

2. **Play Sonification**:
   - Click the "Play" button
   - Adjust tempo (60-180 BPM) and volume
   - Try switching between "Spike" and "Continuous" sonification modes

3. **Compare Datasets**:
   - Select multiple datasets (they'll be added to your loaded datasets)
   - Click "Compare" to see side-by-side visualization
   - Notice how different conditions or brain regions create distinct patterns

## Tips

- Start with smaller datasets for faster loading
- The app auto-detects neurons if no regions file is available
- Each neuron is mapped to a different note in a pentatonic scale
- Synchronized activity creates harmonies; desynchronized activity creates more complex patterns
- Datasets are cached locally after first download for faster subsequent loads

## Troubleshooting

**Proxy server not working:**
- Make sure the proxy server is running on port 3001
- Check that `npm install` was run to install express and cors
- Verify the proxy server started without errors

**Dataset won't load:**
- Check browser console for errors
- Ensure the proxy server is running
- Verify network connectivity to S3

**No sound:**
- Click play and allow browser audio permissions
- Check that volume is not muted
- Ensure Tone.js has initialized (should happen automatically)

**Performance issues:**
- Large datasets (1000+ frames) may take time to download and process
- The app processes data in the browser, so very large files may cause memory issues
- Consider using a subset of frames for initial testing

