import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appStyles as styles } from '../theme/appStyles';
import { colors } from '../theme/theme';

export function ReceiptPeek({ imageUri }: { imageUri?: string }) {
  const [showing, setShowing] = useState(false);

  if (!imageUri) return null;

  return (
    <>
      {showing && (
        <View pointerEvents="none" style={styles.receiptPeekOverlay}>
          <View style={styles.receiptPeekImageFrame}>
            <Image
              accessibilityLabel="Receipt preview"
              resizeMode="contain"
              source={{ uri: imageUri }}
              style={styles.receiptPeekImage}
            />
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to view receipt"
        accessibilityHint="The receipt is shown while this button is held down"
        onPressIn={() => setShowing(true)}
        onPressOut={() => setShowing(false)}
        style={({ pressed }) => [styles.receiptPeekButton, pressed && styles.receiptPeekButtonPressed]}
      >
        <Ionicons name="receipt-outline" size={20} color={colors.brandDeep} />
      </Pressable>
    </>
  );
}
