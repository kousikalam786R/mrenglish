# Logo Sizes Reference

This document tracks the logo sizes used throughout the application. Logo sizes are context-dependent and optimized for each screen's design and purpose.

## Screen-Specific Logo Sizes

| Screen | Logo Size | Purpose |
|--------|-----------|---------|
| **SplashScreen** | 200px | Initial app loading screen - large size for prominent brand display |
| **WelcomeScreen** | 150px | Welcome/intro slides - medium-large for better visibility |
| **SignInScreen** | 180px | Authentication screen - larger for brand visibility and prominence |
| **SignUpScreen** | 180px | Registration screen - larger for brand visibility and prominence |

## Usage Notes

- **Splash screen** uses large size (200px) for prominent brand display on first launch
- **Welcome screen** uses medium-large size (150px) for better visibility while introducing features
- **Authentication screens** (SignIn/SignUp) use larger logos (180px) as these are key entry points where brand recognition is important

## Customizing Logo Sizes

To change a logo size, update the `size` prop in the `<Logo>` component:

```tsx
// Example: Large logo for authentication
<Logo size={180} />

// Example: Medium logo for general use
<Logo size={120} />

// Example: Small logo for headers
<Logo size={80} />
```

The Logo component accepts:
- `size`: Number (default: 120px) - Width and height of the logo
- `style`: ImageStyle - Additional styling
- `resizeMode`: 'contain' | 'cover' | 'stretch' | 'center' (default: 'contain')




