export const colors = {
  brand: '#70CF45',
  brandDeep: '#2F8515',
  brandSoft: '#EFFAE9',
  negativeSoft: '#FDEEEE',
  ink: '#111111',
  secondary: '#666666',
  tertiary: '#A8AAA8',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F7F5',
  separator: '#ECEEEC',
  warning: '#A86100',
  negative: '#C73B3B',
  venmoBlue: '#3D95CE',
  appleBlack: '#000000',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48 };
export const radii = { sm: 12, md: 18, lg: 24, xl: 28, pill: 999 };

// Semantic type roles mirror the hierarchy previously supplied by SwiftUI.
// The default React Native font on iOS is San Francisco, so no font asset is needed.
export const typography = {
  display: { fontSize: 48, lineHeight: 54, fontWeight: '700' as const, letterSpacing: -1.2 },
  screenTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: -0.7 },
  sectionTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.35 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '700' as const, letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 17, lineHeight: 25, fontWeight: '400' as const },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.15 },
  amount: { fontSize: 48, lineHeight: 54, fontWeight: '500' as const, letterSpacing: -1 },
};
