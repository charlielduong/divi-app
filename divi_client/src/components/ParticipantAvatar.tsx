import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import type { Participant } from '../domain/models';

export function ParticipantAvatar({
  participant,
  size,
  style,
  initialStyle,
}: {
  participant: Pick<Participant, 'name' | 'avatarUrl'>;
  size: number;
  style?: StyleProp<ViewStyle>;
  initialStyle?: StyleProp<TextStyle>;
}) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const avatarUrl = participant.avatarUrl?.trim();

  return (
    <View
      accessibilityLabel={`${participant.name}'s profile picture`}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {avatarUrl && failedAvatarUrl !== avatarUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setFailedAvatarUrl(avatarUrl)}
          resizeMode="cover"
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text style={initialStyle}>{participant.name.trim().charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}
