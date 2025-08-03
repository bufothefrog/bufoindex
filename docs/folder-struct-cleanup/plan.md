# BufoIndex File Structure Cleanup Plan

## Important Correction: npm IS Required! ❌ → ✅

**Your npm setup is essential because:**
- TailwindCSS compilation: `themes/bufoindex/assets/css/main.css` → `themes/bufoindex/static/css/style.css`
- Your CSS source uses `@tailwind base`, `@tailwind components`, `@tailwind utilities` directives
- The build process: `npm run build:css` processes these directives into actual CSS
- PostCSS and autoprefixer are part of the pipeline

**KEEP These Files (Essential):**
- ✅ `package.json` - Build scripts and dependencies
- ✅ `package-lock.json` - Dependency locks
- ✅ `node_modules/` - Required npm packages
- ✅ `tailwind.config.js` - TailwindCSS configuration (defines custom colors, etc.)
- ✅ `postcss.config.js` - CSS processing pipeline configuration

## Files to DELETE (Unnecessary/Build Artifacts):

### 1. Build Output Directory
- 🗑️ `public/` - Entire directory (Hugo build output, regenerated on build)

### 2. Hugo Cache/Stats 
- 🗑️ `hugo_stats.json` - Hugo-generated stats file (auto-regenerated)
- 🗑️ `resources/` - Hugo cache directory (auto-regenerated)

### 3. Empty Directories
- 🗑️ `static/` - Currently empty, not needed
- 🗑️ `src/` - Empty directory (if it exists)

## Files to INVESTIGATE:
- 🔍 Check for any orphaned vite.config.js or other config files

## Summary:
- **Keep**: npm ecosystem (essential for CSS build)
- **Delete**: Build artifacts and cache files (~75% size reduction)
- **Result**: Clean repo with only source files, no build output

## File Size Impact:
```
Before cleanup: ~500MB+ (with node_modules and public/)
After cleanup: ~200MB (without public/ and resources/)
```

## Commands to Execute (when approved):
```bash
rm -rf public/
rm -rf resources/
rm hugo_stats.json
rmdir static/ (if empty)
rmdir src/ (if exists and empty)
```