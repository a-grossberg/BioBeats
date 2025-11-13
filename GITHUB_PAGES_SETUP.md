# GitHub Pages Setup Guide

This guide will help you set up BioBeats to run entirely on GitHub Pages for free.

## Step 1: Enable GitHub Pages

1. Go to your repository: `https://github.com/a-grossberg/BioBeats`
2. Click **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. Save the settings

## Step 2: Prepare Datasets (Optional - for full functionality)

The app can work with a few sample datasets. To add more datasets:

```bash
# Install dependencies if needed
npm install

# Prepare datasets (this downloads and processes them)
npm run prepare-datasets 00.00 00.01 00.02
```

This will:
- Download datasets from Neurofinder
- Extract and process them
- Create manifest JSON files
- Copy sample frames to `public/datasets/`

**Note**: Full datasets are large. The script copies the first 100 frames as samples to keep the repo size manageable.

## Step 3: Commit and Push

```bash
git add .
git commit -m "Set up GitHub Pages deployment"
git push origin main
```

## Step 4: Wait for Deployment

GitHub Actions will automatically:
1. Build the site
2. Deploy to GitHub Pages
3. Make it available at: `https://a-grossberg.github.io/BioBeats/`

## Step 5: Test

Once deployed, visit: `https://a-grossberg.github.io/BioBeats/`

## Limitations

- **File Size**: GitHub has a 100MB file size limit. Large datasets are sampled (first 100 frames).
- **Repository Size**: Keep total repo size under 1GB for best performance.
- **Bandwidth**: GitHub Pages has bandwidth limits, but they're generous for personal projects.

## Adding More Datasets

To add more datasets later:

1. Run: `npm run prepare-datasets [dataset-id]`
2. Commit the new files: `git add public/datasets && git commit -m "Add dataset [id]"`
3. Push: `git push origin main`

The GitHub Action will automatically rebuild and deploy.

## Troubleshooting

- **404 errors**: Make sure `base: '/BioBeats/'` in `vite.config.ts` matches your repo name
- **Datasets not loading**: Check that `public/datasets/[id].json` exists
- **Build failures**: Check GitHub Actions logs in the repository

