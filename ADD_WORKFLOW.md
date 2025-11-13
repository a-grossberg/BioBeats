# Add Workflow File to GitHub

The workflow file needs to be added manually on GitHub due to authentication restrictions.

## Quick Steps:

1. **Go to your repository**: https://github.com/a-grossberg/BioBeats

2. **Click "Add file" → "Create new file"**

3. **Enter the path**: `.github/workflows/deploy.yml`

4. **Copy and paste this entire content**:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

5. **Scroll down and click "Commit new file"**

6. **After it commits, go to Settings → Pages**:
   - Make sure "Source" is set to **"GitHub Actions"** (not "Deploy from a branch")
   - If it's not, change it and save

7. **Wait for the workflow to run**:
   - Go to: https://github.com/a-grossberg/BioBeats/actions
   - You should see a new workflow run starting
   - Wait for it to complete (usually 1-2 minutes)

8. **Your site will be live at**: https://a-grossberg.github.io/BioBeats/

## Why This Is Needed:

GitHub is currently using the default Jekyll workflow, which doesn't know how to build a Vite/React app. This custom workflow will:
- Install Node.js and dependencies
- Build your React app with Vite
- Deploy the built files to GitHub Pages

