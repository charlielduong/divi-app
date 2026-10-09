import React, { useRef } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { User } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Divi, formatMoney } from '../domain/models';
import { appStyles as styles } from '../theme/appStyles';
import { colors } from '../theme/theme';

export function WelcomeScreen({
  onGoogleSignIn,
  isLoading,
  error,
}: {
  onGoogleSignIn: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  return (
    <SafeAreaView style={styles.authScreen}>
      <StatusBar style="dark" />
      <View style={[styles.authShell, isDesktop && styles.authShellDesktop]}>
        <View style={styles.authMain}>
          <View style={styles.authBrandRow}>
            <View style={styles.authBrandMark}>
              <Ionicons name="git-compare-outline" size={20} color={colors.surface} />
            </View>
            <Text style={styles.authBrand}>Divi</Text>
          </View>

          <View style={styles.authContent}>
            <Text style={styles.authTitle}>Welcome to Divi</Text>
            <Text style={styles.authSubtitle}>
              Split receipts together, without the awkward math.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={onGoogleSignIn}
              style={({ pressed }) => [
                styles.googleButton,
                (pressed || isLoading) && styles.googleButtonPressed,
              ]}
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={styles.googleButtonLabel}>
                {isLoading ? 'Opening Google…' : 'Continue with Google'}
              </Text>
            </Pressable>
            {error ? <Text style={styles.authError}>{error}</Text> : null}
          </View>

          <Text style={styles.authTerms}>
            By continuing with Google, you agree to our{' '}
            <Text style={styles.authTermsLink}>Terms of Use</Text> and{' '}
            <Text style={styles.authTermsLink}>Privacy Policy</Text>.
          </Text>
        </View>

        {isDesktop && (
          <ImageBackground
            source={require('../../assets/divi-login-panel.png')}
            resizeMode="cover"
            style={styles.authVisual}
            imageStyle={styles.authVisualImage}
          >
            <View style={styles.authVisualCopy}>
              <Text style={styles.authVisualEyebrow}>MADE FOR THE TABLE</Text>
              <Text style={styles.authVisualTitle}>Good plans. Clear totals. Happy groups.</Text>
            </View>
          </ImageBackground>
        )}
      </View>
    </SafeAreaView>
  );
}

export function HomeScreen({
  divis,
  onOpen,
  onDelete,
  onViewReceipts,
  isDesktop = false,
}: {
  divis: Divi[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onViewReceipts: () => void;
  isDesktop?: boolean;
}) {
  if (isDesktop) {
    return (
      <ScrollView contentContainerStyle={styles.dashboardPage}>
        <View style={styles.dashboardHeading}>
          <View>
            <Text style={styles.dashboardEyebrow}>OVERVIEW</Text>
            <Text style={styles.pageTitle}>Your Divis</Text>
          </View>
          <Text style={styles.dashboardDate}>Your shared receipts, in one place</Text>
        </View>
        <View style={styles.dashboardGrid}>
          <View style={[styles.dashboardCard, styles.receiptsCard]}>
            <View style={styles.dashboardCardHeader}>
              <View>
                <Text style={styles.dashboardCardTitle}>Receipts</Text>
                <Text style={styles.dashboardCardSub}>Recent shared bills</Text>
              </View>
              <View style={styles.dashboardCardIcon}>
                <Ionicons name="receipt-outline" size={20} color={colors.brandDeep} />
              </View>
            </View>
            <View style={styles.dashboardCardBody}>
              {divis.length ? (
                divis.map((divi) => (
                  <DiviRow
                    key={divi.id}
                    divi={divi}
                    onPress={() => onOpen(divi.id)}
                    onDelete={() => onDelete(divi.id)}
                    compact
                  />
                ))
              ) : (
                <Text style={styles.dashboardEmpty}>Your saved receipts will appear here.</Text>
              )}
            </View>
            <Pressable onPress={onViewReceipts} style={styles.dashboardCardAction}>
              <Text style={styles.dashboardCardActionLabel}>View all receipts</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.brandDeep} />
            </Pressable>
          </View>

          <View style={styles.dashboardCardPlaceholder}>
            <Ionicons name="sparkles-outline" size={25} color={colors.tertiary} />
            <Text style={styles.dashboardPlaceholderTitle}>More at a glance</Text>
            <Text style={styles.dashboardPlaceholderCopy}>
              Future dashboard cards can live here.
            </Text>
          </View>
          <View style={styles.dashboardCardPlaceholder}>
            <Ionicons name="people-outline" size={25} color={colors.tertiary} />
            <Text style={styles.dashboardPlaceholderTitle}>Your groups</Text>
            <Text style={styles.dashboardPlaceholderCopy}>
              Keep shared dinners and trips nearby.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.pageTitle}>Your Divis</Text>
      <Text style={[styles.sectionTitle, styles.homeSectionTitle]}>Recent</Text>
      {divis.map((divi) => (
        <DiviRow
          key={divi.id}
          divi={divi}
          onPress={() => onOpen(divi.id)}
          onDelete={() => onDelete(divi.id)}
        />
      ))}
    </ScrollView>
  );
}

export function ReceiptsScreen({
  divis,
  onOpen,
  onDelete,
}: {
  divis: Divi[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.pageTitle}>Receipts</Text>
      {divis.map((divi) => (
        <DiviRow
          key={divi.id}
          divi={divi}
          onPress={() => onOpen(divi.id)}
          onDelete={() => onDelete(divi.id)}
        />
      ))}
    </ScrollView>
  );
}
function DiviRow({
  divi,
  onPress,
  onDelete,
  compact = false,
}: {
  divi: Divi;
  onPress: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const gestureStartX = useRef(0);
  const translateRef = useRef(0);
  const close = () => {
    translateRef.current = 0;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 0,
    }).start();
  };
  const openDelete = () => {
    translateRef.current = -92;
    Animated.spring(translateX, {
      toValue: -92,
      useNativeDriver: false,
      bounciness: 0,
    }).start();
  };
  const panResponder = useRef(
    PanResponder.create({
      onPanResponderGrant: () => {
        gestureStartX.current = translateRef.current;
      },
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) >= Math.abs(gesture.dy) * 0.55,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) >= Math.abs(gesture.dy) * 0.55,
      onPanResponderMove: (_, gesture) => {
        const nextX = Math.max(-92, Math.min(0, gestureStartX.current + gesture.dx));
        translateRef.current = nextX;
        translateX.setValue(nextX);
      },
      onPanResponderRelease: (_, gesture) => {
        const currentX = gestureStartX.current + gesture.dx;
        if (currentX < -46 || gesture.vx < -0.25) openDelete();
        else close();
      },
      onPanResponderTerminate: () => {
        if (translateRef.current < -46) openDelete();
        else close();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <View style={styles.swipeableItem}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${divi.title}`}
        onPress={onDelete}
        style={styles.swipeDeleteAction}
      >
        <Ionicons name="trash-outline" size={22} color={colors.surface} />
        <Text style={styles.swipeDeleteLabel}>Delete</Text>
      </Pressable>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.swipeableItemContent, { transform: [{ translateX }] }]}
      >
        <Pressable onPress={onPress} style={[styles.listRow, compact && styles.dashboardListRow]}>
          <View style={[styles.marker, { backgroundColor: markerColor(divi) }]} />
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, compact && styles.dashboardRowTitle]}>{divi.title}</Text>
            <Text style={[styles.rowSub, compact && styles.dashboardRowSub]}>
              {divi.participants.length} people · {divi.state}
            </Text>
          </View>
          <Text style={[styles.rowValue, compact && styles.dashboardRowValue]}>
            {formatMoney(divi.enteredTotal)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function markerColor(divi: Divi) {
  if (divi.state === 'claiming') return colors.warning;
  if (divi.state === 'finalized') return colors.brand;
  return colors.ink;
}

export function SimpleListScreen({
  title,
  rows,
  icon,
}: {
  title: string;
  rows: string[];
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.pageTitle}>{title}</Text>
      {rows.map((row) => (
        <View key={row} style={styles.listRow}>
          <Ionicons name={icon} size={23} color={colors.brandDeep} />
          <Text style={[styles.rowTitle, styles.flex]}>{row}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
export function ProfileScreen({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const metadata = user.user_metadata ?? {};
  const displayName = String(
    metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? 'Divi user',
  );
  const avatarUrl = metadata.avatar_url ?? metadata.picture;
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part: string) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.pageTitle}>Profile</Text>
      <View style={styles.profileAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.profileAvatarImage} />
        ) : (
          <Text style={styles.profileInitial}>{initials}</Text>
        )}
      </View>
      <View style={styles.listRow}>
        <Text style={styles.rowTitle}>Name</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {displayName}
        </Text>
      </View>
      <View style={styles.listRow}>
        <Text style={styles.rowTitle}>Email</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {user.email ?? 'Not provided'}
        </Text>
      </View>
      <Pressable onPress={onSignOut}>
        <Text style={styles.signOut}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
