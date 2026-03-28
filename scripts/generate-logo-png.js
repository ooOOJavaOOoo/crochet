#!/usr/bin/env node

/**
 * SVG to PNG Logo Converter
 * Generates PNG versions of the Crochet Canvas logo for affiliate usage
 * 
 * Install dependencies: npm install sharp svgexport
 * Run: node scripts/generate-logo-png.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logoSvgPath = path.join(__dirname, '../public/crochet-canvas-logo.svg');
const outputDir = path.join(__dirname, '../public/logos');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const conversions = [
  {
    name: 'crochet-canvas-logo.png',
    width: 740,
    height: 220,
    description: 'Full horizontal logo - best for website headers and affiliate materials'
  },
  {
    name: 'crochet-canvas-logo-square.png',
    width: 512,
    height: 512,
    description: 'Square logo - perfect for social media profiles and app icons'
  },
  {
    name: 'crochet-canvas-logo-affiliate.png',
    width: 300,
    height: 90,
    description: 'Affiliate banner format - 300x90 standard web banner'
  },
  {
    name: 'crochet-canvas-logo-icon.png',
    width: 256,
    height: 256,
    description: 'Icon version - for favicons and thumbnails'
  }
];

async function generatePngs() {
  try {
    console.log('🎨 Generating PNG versions of Crochet Canvas logo...\n');

    for (const conversion of conversions) {
      const outputPath = path.join(outputDir, conversion.name);
      
      // For SVG to PNG, we need to create appropriately sized versions
      // The SVG viewBox is 740x220
      
      await sharp(logoSvgPath)
        .resize(conversion.width, conversion.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .png({ quality: 95 })
        .toFile(outputPath);

      console.log(`✅ ${conversion.name}`);
      console.log(`   ${conversion.width}x${conversion.height} - ${conversion.description}\n`);
    }

    console.log('📦 All PNG versions generated successfully!');
    console.log(`📁 Output location: ${outputDir}\n`);
    console.log('Usage recommendations:');
    console.log('- Website: Use crochet-canvas-logo.png (full horizontal)');
    console.log('- Social Media: Use crochet-canvas-logo-square.png');
    console.log('- Affiliate Banners: Use crochet-canvas-logo-affiliate.png');
    console.log('- Favicon/Icon: Use crochet-canvas-logo-icon.png');

  } catch (error) {
    console.error('❌ Error generating PNG files:', error);
    process.exit(1);
  }
}

generatePngs();
