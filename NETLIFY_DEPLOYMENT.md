# Netlify Deployment Guide

Netlify is a great choice for BioBeats because it can host both the static frontend AND serverless functions to replace the proxy server.

## Quick Setup

### Option 1: Deploy via Netlify UI (Easiest)

1. **Push your code to GitHub** (if not already done)

2. **Go to Netlify**:
   - Visit [netlify.com](https://netlify.com)
   - Sign up/login with GitHub
   - Click "Add new site" → "Import an existing project"
   - Select your GitHub repository: `a-grossberg/BioBeats`

3. **Configure build settings**:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - Click "Deploy site"

4. **That's it!** Your site will be live at `https://your-site-name.netlify.app`

### Option 2: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize and deploy
cd BioBeats
netlify init
netlify deploy --prod
```

## How It Works

### Static Frontend
- Netlify serves your built React app from the `dist/` directory
- The `netlify.toml` file configures the build settings

### Serverless Functions (Proxy Replacement)
- The proxy server is replaced with Netlify Functions
- Located in `netlify/functions/neurofinder.js`
- Handles all `/api/neurofinder/*` requests
- Automatically deployed with your site

### Routing
- The `netlify.toml` redirects `/api/*` to `/.netlify/functions/*`
- Your app code doesn't need to change - it still calls `/api/neurofinder/*`

## Important Limitations

⚠️ **Netlify Functions have constraints:**

1. **Execution Time Limits**:
   - Free tier: 10 seconds
   - Pro tier: 26 seconds
   - Large dataset downloads may timeout

2. **File System**:
   - Only `/tmp` is writable (1GB limit)
   - No persistent storage between function calls
   - Cache is in-memory only (lost on cold start)

3. **Memory Limits**:
   - 1GB RAM per function
   - Large ZIP files may cause issues

4. **Size Limits**:
   - Function response: 6MB max
   - Request body: 6MB max

## Solutions for Large Datasets

### Option A: Use Netlify for UI Only
- Deploy frontend to Netlify
- Deploy proxy server separately (Railway, Render, Heroku)
- Update `PROXY_BASE_URL` in code to point to your proxy

### Option B: Optimize Functions
- Stream responses instead of loading entire ZIP
- Use external caching (Redis, Upstash)
- Process frames on-demand instead of all at once

### Option C: Pre-process Data
- Pre-process datasets and store processed JSON
- Serve from CDN or object storage
- Functions just fetch pre-processed data

## Environment Variables

If you need to configure anything:

1. Go to Netlify Dashboard → Site settings → Environment variables
2. Add variables like:
   - `VITE_BASE_PATH` (if needed)
   - `NETLIFY_DEV` (automatically set in dev mode)

## Custom Domain

1. Go to Site settings → Domain management
2. Add your custom domain
3. Follow DNS setup instructions

## Continuous Deployment

Netlify automatically:
- Deploys on every push to `main` branch
- Runs your build command
- Deploys functions
- Updates your live site

## Testing Locally

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run local dev server with functions
netlify dev
```

This will:
- Start your Vite dev server
- Run Netlify Functions locally
- Proxy requests correctly

## Troubleshooting

**Functions not working:**
- Check function logs in Netlify Dashboard
- Verify `netlify.toml` redirects are correct
- Check function timeout limits

**Build fails:**
- Check build logs in Netlify Dashboard
- Verify Node.js version (set in `netlify.toml`)
- Check that all dependencies are in `package.json`

**CORS errors:**
- Functions should handle CORS automatically
- Check function response headers

## Comparison: Netlify vs GitHub Pages

| Feature | Netlify | GitHub Pages |
|---------|---------|--------------|
| Static hosting | ✅ | ✅ |
| Serverless functions | ✅ | ❌ |
| Build automation | ✅ | ✅ (with Actions) |
| Custom domain | ✅ | ✅ |
| Free tier | ✅ | ✅ |
| Proxy server support | ✅ (via Functions) | ❌ |

**Recommendation**: Use Netlify if you want the proxy server functionality. Use GitHub Pages if you only need static hosting and will deploy the proxy separately.

