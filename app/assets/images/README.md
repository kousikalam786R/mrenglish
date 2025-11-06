# Logo Storage Guide

## Where to Store Your Logo

Place your logo files in this directory: `app/assets/images/`

## Logo Format Requirements

### Format
- **Recommended**: PNG format (with transparency support)
- **Alternative**: SVG (if using a library like `react-native-svg`)

### File Naming Convention

For React Native to automatically select the correct size based on device pixel density, use this naming pattern:

1. **Standard resolution (1x)**: `logo.png` (base size, e.g., 120x120px)
2. **High resolution (2x)**: `logo@2x.png` (double size, e.g., 240x240px)
3. **Extra high resolution (3x)**: `logo@3x.png` (triple size, e.g., 360x360px)

### Size Recommendations

- **logo.png**: 120x120 pixels (for standard displays)
- **logo@2x.png**: 240x240 pixels (for Retina/high-DPI displays)
- **logo@3x.png**: 360x360 pixels (for extra high-DPI displays)

### Usage in Code

Once your logo files are in place, you can use them like this:

```typescript
import { Image } from 'react-native';

// React Native will automatically pick the right size
<Image 
  source={require('../assets/images/logo.png')} 
  style={{ width: 120, height: 120 }}
  resizeMode="contain"
/>
```

## App Icon (Optional)

If you also want to replace the app icon (launcher icon), you'll need to:

### For Android:
Place icon files in:
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48px)
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72px)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96px)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144px)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192px)

Also create `ic_launcher_round.png` versions for round icons.

### For iOS:
Place icon files in:
- `ios/mrenglish/Images.xcassets/AppIcon.appiconset/`

You'll need multiple sizes (20pt, 29pt, 40pt, 60pt, etc.) in both 1x, 2x, and 3x versions.

## Notes

- After adding new assets, you may need to restart Metro bundler
- For production builds, assets are bundled automatically
- PNG with transparency works best for logos
- Keep file sizes optimized for faster app loading





