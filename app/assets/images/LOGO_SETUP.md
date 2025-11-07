# Logo Setup Instructions

## Step 1: Resize Your Logo

You need to create 3 versions of your logo in different sizes:

1. **logo.png** - 120x120 pixels (1x resolution)
2. **logo@2x.png** - 240x240 pixels (2x resolution for high-DPI screens)
3. **logo@3x.png** - 360x360 pixels (3x resolution for extra high-DPI screens)

### Tools to Resize:
- **Online tools**: 
  - https://www.iloveimg.com/resize-image
  - https://resizeimage.net/
  - https://www.resizepixel.com/
- **Desktop software**: 
  - GIMP (free)
  - Photoshop
  - Paint.NET (Windows, free)
  - Preview (Mac)

### Steps:
1. Take your original logo file
2. Resize it to 120x120px → Save as `logo.png`
3. Resize it to 240x240px → Save as `logo@2x.png`
4. Resize it to 360x360px → Save as `logo@3x.png`
5. Make sure to maintain aspect ratio and keep transparency if your logo has it

## Step 2: Place Files in Directory

Copy all three files to:
```
app/assets/images/
```

Your directory should look like:
```
app/assets/images/
  ├── logo.png
  ├── logo@2x.png
  ├── logo@3x.png
  └── README.md
```

## Step 3: After Adding Files

Once you've placed the logo files, you can:
1. Restart Metro bundler if it's running
2. The logo will be ready to use in your app






