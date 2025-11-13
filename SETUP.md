# BioBeats Setup Guide

## Quick Start for GitHub Pages

### Step 1: Push Your Code to GitHub

Since there's an authentication issue with workflow files, you have two options:

**Option A: Push everything except the workflow file first**
```bash
cd /Users/wyssuser/Desktop/BioBeats
git rm --cached .github/workflows/deploy.yml
git commit -m "Remove workflow file temporarily"
git push origin main
```

Then manually create the workflow file on GitHub:
1. Go to: https://github.com/a-grossberg/BioBeats
2. Click "Add file" → "Create new file"
3. Path: `.github/workflows/deploy.yml`
4. Copy the contents from the file in your local repo
5. Commit directly on GitHub

**Option B: Fix GitHub authentication**
```bash
gh auth login
gh auth setup-git
git push origin main
```

### Step 2: Enable GitHub Pages

1. Go to: https://github.com/a-grossberg/BioBeats/settings/pages
2. Under **Source**, select: **GitHub Actions**
3. Click **Save**

### Step 3: Wait for Deployment

- GitHub Actions will automatically build and deploy
- Check status at: https://github.com/a-grossberg/BioBeats/actions
- Once complete, your site will be at: `https://a-grossberg.github.io/BioBeats/`

### Step 4: Test the App

1. Visit: `https://a-grossberg.github.io/BioBeats/`
2. Click a dataset button (A1-A20)
3. The app will:
   - Download the ZIP from S3
   - Extract it in your browser
   - Load all frames
   - Be ready to play!

## How It Works

- **No server needed** - Everything runs in the browser
- **Direct from S3** - Downloads ZIP files from Neurofinder S3 bucket
- **Client-side extraction** - Uses JSZip to extract in browser
- **All frames** - Gets all frames for all 19 datasets
- **Free** - No hosting costs, no storage limits

## Troubleshooting

### If datasets don't load:

1. **Check browser console** for errors
2. **CORS issues**: The app will try a CORS proxy automatically
3. **Large files**: ZIP files are 50-200MB, so first load may take a few minutes
4. **Network issues**: Make sure you have a stable internet connection

### If GitHub Pages doesn't deploy:

1. Check GitHub Actions: https://github.com/a-grossberg/BioBeats/actions
2. Look for build errors
3. Make sure `base: '/BioBeats/'` in `vite.config.ts` matches your repo name

### For Local Development:

```bash
# Just run the dev server (no proxy needed!)
npm run dev
```

The app will try to fetch from S3 directly. If that fails, you can still use the proxy:

```bash
# Terminal 1: Proxy server
npm run proxy

# Terminal 2: Dev server  
npm run dev
```

## What's Different Now

✅ **Before**: Needed Netlify/Render with server-side processing  
✅ **Now**: Pure client-side, works on GitHub Pages  
✅ **Before**: Had to download/store datasets  
✅ **Now**: Streams directly from S3, extracts in browser  
✅ **Before**: Limited by hosting credits  
✅ **Now**: Completely free, unlimited

## Next Steps

1. Push your code (see Step 1)
2. Enable GitHub Pages (see Step 2)
3. Wait for deployment
4. Test with a dataset
5. Share your jukebox! 🎵

