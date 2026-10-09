import React, { PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '../theme/theme';

export const PrimaryButton = ({
  title,
  onPress,
  onPressIn,
  disabled,
}: {
  title: string;
  onPress: () => void;
  onPressIn?: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    onPressIn={onPressIn}
    style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonMuted]}
  >
    <Text style={styles.buttonText}>{title}</Text>
  </Pressable>
);

export const Pill = ({
  title,
  tone = 'green',
}: {
  title: string;
  tone?: 'green' | 'orange' | 'black';
}) => (
  <View
    style={[
      styles.pill,
      tone === 'orange' && styles.pillOrange,
      tone === 'black' && styles.pillBlack,
    ]}
  >
    <Text
      style={[
        styles.pillText,
        tone === 'orange' && styles.pillTextOrange,
        tone === 'black' && styles.pillTextBlack,
      ]}
    >
      {title}
    </Text>
  </View>
);

export const Screen = ({ children }: PropsWithChildren) => (
  <View style={styles.screen}>{children}</View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  button: {
    minHeight: 58,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 8px rgba(47, 133, 21, 0.12)' }
      : {
          shadowColor: colors.brandDeep,
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }),
  },
  buttonMuted: { opacity: 0.62, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFFFFF', ...typography.headline },
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.brandSoft,
  },
  pillText: { color: colors.brandDeep, ...typography.caption },
  pillOrange: { backgroundColor: '#FFF3E1' },
  pillTextOrange: { color: colors.warning },
  pillBlack: { backgroundColor: colors.ink },
  pillTextBlack: { color: '#FFFFFF' },
});
