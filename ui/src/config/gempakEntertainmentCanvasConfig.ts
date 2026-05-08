// Gempak Entertainment Canvas Config — portrait 1080×1350.
// Mirrors EPL's Cloudinary transformation layout (face-aware photo, black fade
// gradient, white headline + subtitle stacked above brand logo) but rendered
// client-side via fabric.js so we skip a server round-trip per preview.

export interface TextLayerStyle {
  fontFamily: string
  fontSize: number
  fontWeight: string | number
  fill: string
  fontStyle?: 'normal' | 'italic'
  lineHeight?: number
  // em-relative; Fabric uses charSpacing in 1/1000 em units
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right'
  uppercase?: boolean
}

export interface GempakEntertainmentCanvasConfig {
  canvas: {
    width: number
    height: number
    backgroundColor: string
  }
  // Full-bleed photo with face-aware crop (matches Cloudinary g_face).
  photo: {
    cropMode: 'face' | 'auto'
  }
  // Bottom-anchored darkening gradient — gives headline/subtitle contrast on
  // any photo. Mirrors EPL's `l_black_fade_pexvn5` overlay.
  bottomGradient: {
    coverageRatio: number   // 0..1 — fraction of canvas height covered
    color: string           // hex (e.g. "#000000")
    startOpacity: number    // 0..1 — opacity at gradient's top edge
    endOpacity: number      // 0..1 — opacity at canvas bottom
  }
  // Optional kicker label rendered above the headline (driven by idea.type).
  // Disabled by default to match EPL's `showTypeOnImage=false` behavior.
  typeLabel: {
    enabled: boolean
    style: TextLayerStyle
    // y coordinate from top of canvas (matches Cloudinary g_north,y_845).
    yFromTop: number
    maxWidth: number
  }
  headline: {
    style: TextLayerStyle
    yFromTop: number
    maxWidth: number
    // Tier-based scaling — long headlines shrink to avoid wrapping past 3 lines.
    dynamicSizing: Array<{ maxLength: number; scale: number }>
  }
  subtitle: {
    style: TextLayerStyle
    yFromTop: number
    maxWidth: number
    dynamicSizing: Array<{ maxLength: number; scale: number }>
  }
  logo: {
    // Width target in px. Height is derived from the logo's aspect ratio,
    // capped by maxHeight.
    width: number
    maxHeight: number
    // Distance in px from the bottom edge of the canvas.
    yFromBottom: number
  }
}

export const DEFAULT_GEMPAK_ENT_CANVAS_CONFIG: GempakEntertainmentCanvasConfig = {
  canvas: {
    width: 1080,
    height: 1350,
    backgroundColor: '#111111',
  },
  photo: {
    cropMode: 'face',
  },
  bottomGradient: {
    coverageRatio: 1,
    color: '#000000',
    startOpacity: 0,
    endOpacity: 0.85,
  },
  typeLabel: {
    enabled: false,
    style: {
      fontFamily: 'Montserrat',
      fontSize: 38,
      fontWeight: 600,
      fill: '#FFD700',
      textAlign: 'center',
      uppercase: true,
      letterSpacing: 0.05,
    },
    yFromTop: 845,
    maxWidth: 700,
  },
  headline: {
    style: {
      fontFamily: 'Montserrat',
      fontSize: 90,
      fontWeight: 700,
      fill: '#FFFFFF',
      textAlign: 'center',
      lineHeight: 0.95,
      letterSpacing: -0.02,
    },
    yFromTop: 900,
    maxWidth: 900,
    dynamicSizing: [
      { maxLength: 18, scale: 1 },
      { maxLength: 26, scale: 0.85 },
      { maxLength: 35, scale: 0.7 },
    ],
  },
  subtitle: {
    style: {
      fontFamily: 'Montserrat',
      fontSize: 38,
      fontWeight: 400,
      fill: '#FFFFFF',
      textAlign: 'center',
      lineHeight: 1.2,
    },
    yFromTop: 1100,
    maxWidth: 850,
    dynamicSizing: [
      { maxLength: 40, scale: 1 },
      { maxLength: 60, scale: 0.9 },
      { maxLength: 70, scale: 0.8 },
    ],
  },
  logo: {
    width: 150,
    maxHeight: 80,
    yFromBottom: 35,
  },
}
