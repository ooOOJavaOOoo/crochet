# Logo PNG Generation Guide

Your Crochet Canvas logo is now available in multiple PNG formats for affiliate usage.

## Generated Formats

The script generates these affiliate-ready PNG versions:

| File | Dimensions | Best For |
|------|-----------|----------|
| `crochet-canvas-logo.png` | 740×220 | Website headers, landing pages |
| `crochet-canvas-logo-square.png` | 512×512 | Social media profiles, app icons, rounded avatars |
| `crochet-canvas-logo-affiliate.png` | 300×90 | Standard web affiliate banners |
| `crochet-canvas-logo-icon.png` | 256×256 | Favicons, social media thumbnails |

## How to Generate

1. **Install dependencies:**
   ```bash
   npm install --save-dev sharp
   ```

2. **Run the converter:**
   ```bash
   node scripts/generate-logo-png.js
   ```

3. **Check output:**
   PNG files will be generated in `public/logos/` directory

## Features

- ✅ Transparent background (PNG with alpha channel)
- ✅ High quality (95% PNG quality)
- ✅ Multiple sizes for different use cases
- ✅ Ready for web, social media, and affiliate programs

## Usage Tips

### For Affiliate Programs
- Use `crochet-canvas-logo-affiliate.png` for banner ads
- Use `crochet-canvas-logo-square.png` for product thumbnails
- Include with affiliate marketing materials

### For Web
- Use `crochet-canvas-logo.png` for headers and page branding
- Use `crochet-canvas-logo-icon.png` for favicon

### For Social Media
- Use `crochet-canvas-logo-square.png` for profile pictures
- Use any version for posts (adjust as needed)

## Automated Generation with npm

You can add this to your `package.json` scripts:

```json
"scripts": {
  "generate-logos": "node scripts/generate-logo-png.js"
}
```

Then run: `npm run generate-logos`

## Technical Details

- **Source**: `public/crochet-canvas-logo.svg`
- **Output**: `public/logos/`
- **Background**: Transparent (RGBA)
- **Compression**: 95% quality for optimal file size

---

Need other formats or sizes? Edit `scripts/generate-logo-png.js` and modify the `conversions` array.
