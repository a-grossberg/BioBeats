# Deploy Proxy Server to Render (Free Tier)

Render offers a free tier that's perfect for the BioBeats proxy server.

## Quick Setup

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (free)

### Step 2: Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository: `a-grossberg/BioBeats`
3. Configure:
   - **Name**: `biobeats-proxy` (or any name you like)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/proxy.cjs`
   - **Plan**: `Free`

4. Click "Create Web Service"

### Step 3: Update Your App
Once deployed, Render will give you a URL like: `https://biobeats-proxy.onrender.com`

Update the app to use this URL:

1. In `src/utils/neurofinderFetcher.ts`, change:
   ```typescript
   const PROXY_BASE_URL = import.meta.env.PROD 
     ? 'https://your-proxy-url.onrender.com/api/neurofinder'
     : '/api/neurofinder';
   ```

2. Or use an environment variable:
   - In Netlify: Site settings → Environment variables
   - Add: `VITE_PROXY_URL` = `https://your-proxy-url.onrender.com`
   - Then in code: `const PROXY_BASE_URL = import.meta.env.VITE_PROXY_URL || '/api/neurofinder'`

## Free Tier Limitations

- **Spins down after 15 minutes** of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- **750 hours/month** free (enough for ~24/7 if you keep it active)
- **512MB RAM** (should be enough for the proxy)

## Tips

1. **Keep it warm**: Use a service like [UptimeRobot](https://uptimerobot.com) (free) to ping your Render service every 10 minutes
2. **Monitor usage**: Check Render dashboard to see if you're approaching limits
3. **Upgrade if needed**: Render's paid tier ($7/month) removes spin-down and gives more resources

## Alternative: Railway

Railway also works but requires payment after $5 free credit:
- Sign up at [railway.app](https://railway.app)
- Connect GitHub repo
- Deploy `server/proxy.cjs`
- Uses `PORT` environment variable automatically

## Testing Locally

The proxy server works the same way:
```bash
npm run proxy
```

It will run on `http://localhost:3001` (or whatever PORT you set)

