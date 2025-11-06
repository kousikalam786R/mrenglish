# App Icon Setup Guide

This guide explains how to replace the default React Native app icon with your MrEnglish logo.

## Overview

App icons are platform-specific and require different sizes for different screen densities. You'll need to create multiple icon sizes from your logo.

## Quick Setup Tools

**Recommended Online Tools:**
1. **App Icon Generator** - https://appicon.co/
2. **Icon Kitchen** (Android) - https://icon.kitchen/
3. **MakeAppIcon** - https://makeappicon.com/
4. **Asset Catalog Creator** (iOS) - Built into Xcode

**Recommended Desktop Tools:**
- **GIMP** (Free) - https://www.gimp.org/
- **Photoshop**
- **ImageMagick** (Command line)
- **Preview** (Mac)

## Android App Icon Setup

### Required Sizes

Android requires icons in multiple densities:

| Folder | Density | Size (px) | Purpose |
|--------|---------|-----------|---------|
| `mipmap-mdpi` | Medium | 48x48 | Standard density |
| `mipmap-hdpi` | High | 72x72 | High density |
| `mipmap-xhdpi` | Extra High | 96x96 | Extra high density |
| `mipmap-xxhdpi` | Extra Extra High | 144x144 | XXH density |
| `mipmap-xxxhdpi` | Extra Extra Extra High | 192x192 | XXXH density |

**Note:** You need both `ic_launcher.png` and `ic_launcher_round.png` for each density.

### Steps:

1. **Prepare Your Logo:**
   - Use your `mrenglish-logo.png` as the source
   - For best results, ensure your logo has:
     - Square aspect ratio (1:1)
     - Transparent background (if needed)
     - Clear visibility at small sizes

2. **Generate Android Icons:**
   - Go to https://icon.kitchen/ or https://appicon.co/
   - Upload your logo image
   - Select "Android" platform
   - Download the generated icon pack

3. **Replace Icons in Project:**
   
   Replace the following files in your project:
   ```
   android/app/src/main/res/
   ├── mipmap-mdpi/
   │   ├── ic_launcher.png (48x48)
   │   └── ic_launcher_round.png (48x48)
   ├── mipmap-hdpi/
   │   ├── ic_launcher.png (72x72)
   │   └── ic_launcher_round.png (72x72)
   ├── mipmap-xhdpi/
   │   ├── ic_launcher.png (96x96)
   │   └── ic_launcher_round.png (96x96)
   ├── mipmap-xxhdpi/
   │   ├── ic_launcher.png (144x144)
   │   └── ic_launcher_round.png (144x144)
   └── mipmap-xxxhdpi/
       ├── ic_launcher.png (192x192)
       └── ic_launcher_round.png (192x192)
   ```

4. **Rebuild the App:**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npx react-native run-android
   ```

## iOS App Icon Setup

### Required Sizes

iOS requires multiple icon sizes for different devices and contexts:

| Size | Resolution | Purpose |
|------|------------|---------|
| 20pt | 20x20, 40x40, 60x60 | Notification icon |
| 29pt | 29x29, 58x58, 87x87 | Settings icon |
| 40pt | 40x40, 80x80, 120x120 | Spotlight icon |
| 60pt | 60x60, 120x120, 180x180 | App icon |

### Steps:

1. **Generate iOS Icons:**
   - Use Xcode Asset Catalog Creator, or
   - Go to https://appicon.co/ or https://makeappicon.com/
   - Upload your logo
   - Select "iOS" platform
   - Download the generated icon set

2. **Using Xcode (Recommended):**
   - Open `ios/mrenglish.xcodeproj` in Xcode
   - Navigate to `Images.xcassets` > `AppIcon`
   - Drag and drop your generated icon images into the appropriate slots
   - Xcode will automatically organize them

3. **Manual Setup:**
   
   Replace files in:
   ```
   ios/mrenglish/Images.xcassets/AppIcon.appiconset/
   ```
   
   Update `Contents.json` to reference your icon files.

4. **Rebuild the App:**
   ```bash
   cd ios
   pod install
   cd ..
   npx react-native run-ios
   ```

## Alternative: Quick Manual Method

If you want to do it manually:

### For Android:

1. Open your logo in an image editor
2. Resize to each required size
3. Save as PNG with no transparency (for best results)
4. Replace the corresponding files in the mipmap folders

### For iOS:

1. Use Xcode's Asset Catalog
2. Drag your icons into the appropriate slots in Xcode
3. Xcode handles the file naming automatically

## Testing

After replacing icons:

1. **Clean build:**
   - Android: `cd android && ./gradlew clean`
   - iOS: Clean build folder in Xcode

2. **Uninstall old app** from device/emulator

3. **Rebuild and install:**
   ```bash
   # Android
   npx react-native run-android
   
   # iOS
   npx react-native run-ios
   ```

4. **Verify:**
   - Check home screen/app drawer
   - Check app switcher
   - Check settings (iOS)

## Tips

- **Design Guidelines:**
  - Keep important elements in the center (icons may be cropped on some devices)
  - Avoid text that's too small
  - Use high contrast colors
  - Test on actual devices if possible

- **Android Round Icons:**
  - Ensure important content is within a circular safe area
  - Some devices automatically add padding

- **iOS:**
  - iOS automatically adds rounded corners
  - Don't add rounded corners manually unless targeting specific iOS versions

## Troubleshooting

**Icon not updating:**
- Clear app data/cache
- Uninstall and reinstall
- Clean build folders
- Restart device/emulator

**Icon looks blurry:**
- Ensure you're using the correct size for the device density
- Check that you haven't mixed up icon sizes between folders

**Build errors:**
- Ensure all required icon sizes are present
- Check file names match exactly (case-sensitive on some systems)





