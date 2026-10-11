import React from 'react';
import { Image } from 'react-native';
import { SvgUri } from 'react-native-svg';

const logoAsset = require('../../assets/icon.png');

export function DiviLogo({
  size = 48,
  accessibilityLabel = 'Divi',
}: {
  size?: number;
  accessibilityLabel?: string;
}) {
  // Metro exposes bundled SVGs as a URI on web and as a numeric asset module
  // on native. Resolve each form for the platform instead of assuming the web
  // shape, which prevents the logo from disappearing on iOS/Android.
  const uri =
    typeof logoAsset === 'number'
      ? Image.resolveAssetSource(logoAsset).uri
      : typeof logoAsset === 'string'
        ? logoAsset
        : (logoAsset as { uri: string }).uri;

  return <SvgUri accessibilityLabel={accessibilityLabel} height={size} uri={uri} width={size} />;
}
