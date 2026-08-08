# OMP Dashboard Resources

This directory contains static resource files used by the OMP Dashboard plugin.

## Structure

```
resources/
└── icons/       # Icon images (PNG) for Flexbar keys
```

## Icons

Icons are rendered at build time and stored as PNG files in `icons/`. At runtime, the plugin reads these files and converts them to Base64 for display on the Flexbar screen.

Currently, the OMP Dashboard plugin uses MDI (Material Design Icons) font icons specified in `manifest.json` style objects, so no pre-rendered PNG icons are required. This directory is reserved for future custom icon assets.

## Notes

- Icon files should be 48x48 pixels PNG format for optimal display on Flexbar.
- The plugin uses `resourcesPath` from the SDK to locate this directory at runtime.
