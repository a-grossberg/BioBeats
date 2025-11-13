# Handling .tiff Data Files

## Current Setup ✅

The `.gitignore` file already excludes `.tiff` files from version control:
- `*.tif` and `*.tiff` files are ignored
- The `data/` directory is ignored
- This prevents large files from bloating the repository

## How Data is Currently Handled

1. **On-Demand Download**: Datasets are downloaded from S3 when needed
2. **Local Caching**: Downloaded datasets are cached in `data/cache/` (excluded from git)
3. **Pre-loading**: Use `npm run preload` to download datasets before use

## Options for Sharing Data

### Option 1: Keep Current Approach (Recommended)
- ✅ No large files in repository
- ✅ Users download data on-demand
- ✅ Fast repository clones
- ❌ Requires internet connection to use

**Best for**: Public repositories, open-source projects

### Option 2: Git LFS (Git Large File Storage)
If you want to include sample datasets in the repository:

```bash
# Install Git LFS
brew install git-lfs  # macOS
# or download from: https://git-lfs.github.com/

# Initialize in repository
cd BioBeats
git lfs install

# Track .tiff files with LFS
git lfs track "*.tif"
git lfs track "*.tiff"
git lfs track "data/**/*.tif"
git lfs track "data/**/*.tiff"

# Add .gitattributes (created automatically)
git add .gitattributes

# Now .tiff files will be stored in LFS
git add data/sample/*.tiff
git commit -m "Add sample dataset via LFS"
```

**Best for**: Including small sample datasets, educational purposes

**Note**: GitHub LFS has storage limits (1GB free, then paid)

### Option 3: Separate Data Repository
Create a separate repository for data:

```bash
# Create a separate repo for data
gh repo create BioBeats-Data --public
# Then users can clone it separately
```

**Best for**: Very large datasets, frequent data updates

### Option 4: Cloud Storage Links
Document where to download data in README:

```markdown
## Sample Datasets

Download sample datasets from:
- [Dataset 00.00](https://s3.amazonaws.com/neuro.datasets/...)
- [Dataset 00.01](https://s3.amazonaws.com/neuro.datasets/...)
```

**Best for**: Large datasets, external data sources

## Recommendations

For **BioBeats**, the current approach is ideal because:

1. **Datasets are already publicly available** from Neurofinder
2. **Users can pre-load** datasets they need
3. **Repository stays lightweight** and fast to clone
4. **No storage costs** for hosting large files

## If You Want to Add Sample Data

If you want to include a small sample dataset for quick demos:

1. **Use Git LFS** for files under 100MB
2. **Place in `public/sample-data/`** for direct browser access
3. **Document in README** where to get full datasets

Example structure:
```
public/
  sample-data/
    sample_00.tif  # Small sample (via LFS or direct)
    sample_01.tif
    README.md      # Links to full datasets
```

## Current Data Flow

```
User selects dataset
    ↓
Check local cache (data/cache/{id}/)
    ↓
If not found → Download from S3 via proxy
    ↓
Extract ZIP → Process TIFF files
    ↓
Cache for future use
```

The `data/cache/` directory is excluded from git, so cached files stay local.

