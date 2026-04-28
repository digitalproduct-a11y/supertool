// Did You Know Canvas Layout Config (portrait 1080×1350)
// Adjust values here to change positions, sizes, colors, fonts — no code changes needed.

export interface DidYouKnowCanvasConfig {
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  gradient: {
    color: string;
    colorStops: Array<{ offset: number; opacity: number }>;
  };
  logo: {
    height: number;
    marginTop: number;
    marginRight: number;
  };
  editionLabel: {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    color: string;
    backgroundColor: string;
    paddingH: number;
    paddingV: number;
    charSpacing: number;
    marginBottom: number;
  };
  headline: {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fill: string;
    lineHeight: number;
    charSpacing: number;
    maxWidth: number;
    marginBottom: number;
    shadow: {
      color: string;
      blur: number;
      offsetX: number;
      offsetY: number;
    };
  };
  divider: {
    width: number;
    height: number;
    color: string;
    marginBottom: number;
  };
  accentBar: {
    width: number;
    color: string;
    gap: number;
  };
  fact: {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fill: string;
    lineHeight: number;
    maxWidth: number;
  };
  layout: {
    sidePadding: number;
    bottomPadding: number;
  };
}

export const DEFAULT_DID_YOU_KNOW_CANVAS_CONFIG: DidYouKnowCanvasConfig = {
  canvas: {
    width: 1080,
    height: 1350,
    backgroundColor: '#060608',
  },
  gradient: {
    color: '#060608',
    colorStops: [
      { offset: 0, opacity: 0 },
      { offset: 0.3, opacity: 0.1 },
      { offset: 0.55, opacity: 0.506 },
      { offset: 0.78, opacity: 0.81 },
      { offset: 1, opacity: 0.92 },
    ],
  },
  logo: {
    height: 120,
    marginTop: 56,
    marginRight: 56,
  },
  editionLabel: {
    fontFamily: 'JetBrains Mono',
    fontSize: 10,
    fontWeight: '600',
    color: '#E9B949',
    backgroundColor: '#000000',
    paddingH: 4,
    paddingV: 2,
    charSpacing: 100,
    marginBottom: 8,
  },
  headline: {
    fontFamily: 'Montserrat',
    fontSize: 28,
    fontWeight: '900',
    fill: '#faf7ee',
    lineHeight: 0.98,
    charSpacing: -43,
    maxWidth: 968,
    marginBottom: 8,
    shadow: {
      color: 'rgba(0,0,0,0.5)',
      blur: 4,
      offsetX: 0,
      offsetY: -60,
    },
  },
  divider: {
    width: 120,
    height: 1,
    color: 'rgba(250,247,238,0.35)',
    marginBottom: 12,
  },
  accentBar: {
    width: 3,
    color: '#E9B949',
    gap: 12,
  },
  fact: {
    fontFamily: 'Montserrat',
    fontSize: 12,
    fontWeight: '400',
    fill: 'rgba(245,242,234,0.9)',
    lineHeight: 1.5,
    maxWidth: 953,
  },
  layout: {
    sidePadding: 56,
    bottomPadding: 40,
  },
};
