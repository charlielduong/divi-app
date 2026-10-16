import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgUri } from 'react-native-svg';
import { ParticipantAvatar } from '../components/ParticipantAvatar';
import { Divi, formatMoney, Participant } from '../domain/models';
import { parseReceiptDate } from '../domain/receiptDate';
import { homeDateLabel } from '../domain/homeDateLabel';
import { appStyles as styles } from '../theme/appStyles';
import { colors } from '../theme/theme';

const onboardingLogoAsset = require('../../assets/icon-no-bg.svg');

function OnboardingLogo() {
  const uri =
    typeof onboardingLogoAsset === 'number'
      ? Image.resolveAssetSource(onboardingLogoAsset).uri
      : typeof onboardingLogoAsset === 'string'
        ? onboardingLogoAsset
        : (onboardingLogoAsset as { uri: string }).uri;

  return <SvgUri accessibilityLabel="Divi receipt logo" height={96} uri={uri} width={96} />;
}

function OnboardingBackground({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={['#A7E878', '#65C94A', '#2E9A4D']}
      locations={[0, 0.48, 1]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.authShell}
    >
      {children}
    </LinearGradient>
  );
}

export function WelcomeScreen({
  onGoogleSignIn,
  isLoading,
  error,
}: {
  onGoogleSignIn: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <OnboardingBackground>
      <SafeAreaView style={styles.authScreen}>
        <StatusBar style="light" />
        <View style={styles.authMain}>
          <View style={styles.authContent}>
            <OnboardingLogo />
            <Text accessibilityRole="header" style={styles.authTitle}>
              Welcome to Divi
            </Text>
            <Text style={styles.authSubtitle}>Restaurant bill-splitting made simple</Text>
          </View>

          <View style={styles.authActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign up with Google"
              disabled={isLoading}
              onPress={onGoogleSignIn}
              style={({ pressed }) => [
                styles.googleButton,
                (pressed || isLoading) && styles.googleButtonPressed,
              ]}
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={styles.googleButtonLabel}>
                {isLoading ? 'Opening Google…' : 'Sign up with Google'}
              </Text>
            </Pressable>
            {error ? <Text style={styles.authError}>{error}</Text> : null}
            <Text style={styles.authTerms}>
              By creating an account you accept{'\n'}
              <Text style={styles.authTermsLink}>Terms of Use</Text> and{' '}
              <Text style={styles.authTermsLink}>Privacy Policy</Text>.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </OnboardingBackground>
  );
}

export function HomeScreen({
  divis,
  onContinue,
  onAdjust,
  onDelete,
  onRefresh,
  isDesktop = false,
}: {
  divis: Divi[];
  onContinue: (id: string) => void;
  onAdjust: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => Promise<void>;
  isDesktop?: boolean;
}) {
  const [selectedDivi, setSelectedDivi] = React.useState<Divi | null>(null);
  const [actionDivi, setActionDivi] = React.useState<Divi | null>(null);
  const [deleteConfirmDivi, setDeleteConfirmDivi] = React.useState<Divi | null>(null);
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<SortOption>('created-desc');
  const [sortOpen, setSortOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  const query = normalizeSearch(search);
  const visibleDivis = divis
    .filter((divi) => !query || searchableDiviText(divi).includes(query))
    .sort((left, right) => compareDivis(left, right, sort));
  const requestDelete = (divi: Divi) => {
    setActionDivi(null);
    setSelectedDivi(null);
    setDeleteConfirmDivi(divi);
  };
  return (
    <>
      <View style={styles.homeScreenLayout}>
        <View style={styles.homeStickyHeader}>
          <LinearGradient
            pointerEvents="none"
            colors={['#FAFBF9', 'rgba(250,251,249,0.78)', 'rgba(250,251,249,0)']}
            locations={[0, 0.58, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.homeStickyGradient}
          />
          <View style={[styles.homeStickyContent, isDesktop && styles.homeStickyContentDesktop]}>
            <View style={styles.homeSearchRow}>
              <View style={styles.homeSearchBox}>
                <Ionicons name="search" size={19} color={colors.secondary} />
                <TextInput
                  accessibilityLabel="Search receipts"
                  placeholder="Search merchants, items, people"
                  placeholderTextColor={colors.tertiary}
                  returnKeyType="search"
                  value={search}
                  onChangeText={setSearch}
                  style={styles.homeSearchInput}
                />
                {search.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => setSearch('')}
                  >
                    <Ionicons name="close-circle" size={19} color={colors.tertiary} />
                  </Pressable>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sort and filter receipts"
                onPress={() => setSortOpen(true)}
                style={styles.homeSortButton}
              >
                <Ionicons name="options-outline" size={21} color={colors.ink} />
              </Pressable>
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={[
            styles.homeFeed,
            isDesktop && styles.homeFeedDesktop,
            { paddingTop: isDesktop ? 92 : 80 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              progressViewOffset={isDesktop ? 92 : 80}
              tintColor={colors.brandDeep}
              colors={[colors.brandDeep]}
            />
          }
        >
          {visibleDivis.map((divi) => (
            <HomeDiviCard
              key={divi.id}
              divi={divi}
              onPress={() => setSelectedDivi(divi)}
              onMore={() => setActionDivi(divi)}
              desktop={isDesktop}
            />
          ))}
          {!visibleDivis.length && (
            <Text style={styles.dashboardEmpty}>
              {search ? 'No receipts match your search.' : 'Your shared receipts will appear here.'}
            </Text>
          )}
        </ScrollView>
      </View>
      <FinalBalancesSheet
        divi={selectedDivi}
        onClose={() => setSelectedDivi(null)}
        onContinue={onContinue}
        onAdjust={onAdjust}
        onRequestDelete={requestDelete}
      />
      <HomeCardActionsSheet
        divi={actionDivi}
        onClose={() => setActionDivi(null)}
        onContinue={onContinue}
        onAdjust={onAdjust}
        onRequestDelete={requestDelete}
      />
      <DeleteConfirmationSheet
        divi={deleteConfirmDivi}
        onCancel={() => setDeleteConfirmDivi(null)}
        onConfirm={() => {
          if (!deleteConfirmDivi) return;
          onDelete(deleteConfirmDivi.id);
          setDeleteConfirmDivi(null);
        }}
      />
      <SortOptionsSheet
        selected={sort}
        visible={sortOpen}
        onSelect={setSort}
        onClose={() => setSortOpen(false)}
      />
    </>
  );
}

type SortOption =
  'created-desc' | 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';
const sortOptions: { id: SortOption; title: string; subtitle: string }[] = [
  { id: 'created-desc', title: 'Recently added', subtitle: 'Newest Divis first' },
  { id: 'date-asc', title: 'Date: oldest first', subtitle: 'Receipt date ascending' },
  { id: 'date-desc', title: 'Date: newest first', subtitle: 'Receipt date descending' },
  { id: 'name-asc', title: 'Name: A to Z', subtitle: 'Merchant name ascending' },
  { id: 'name-desc', title: 'Name: Z to A', subtitle: 'Merchant name descending' },
  { id: 'price-asc', title: 'Price: low to high', subtitle: 'Total ascending' },
  { id: 'price-desc', title: 'Price: high to low', subtitle: 'Total descending' },
];

function SortOptionsSheet({
  selected,
  visible,
  onSelect,
  onClose,
}: {
  selected: SortOption;
  visible: boolean;
  onSelect: (option: SortOption) => void;
  onClose: () => void;
}) {
  return (
    <DismissibleBottomSheet
      visible={visible}
      onClose={onClose}
      onDismissLabel="Close sort options"
      sheetStyle={styles.sortSheet}
    >
          <View style={styles.sortSheetHeading}>
            <Text style={styles.homeSheetTitle}>Sort and filter</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sort options"
              onPress={onClose}
              style={styles.homeSheetClose}
            >
              <Ionicons name="close" size={21} color={colors.secondary} />
            </Pressable>
          </View>
          {sortOptions.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === option.id }}
              onPress={() => {
                onSelect(option.id);
                onClose();
              }}
              style={styles.sortOption}
            >
              <View style={styles.sortOptionCopy}>
                <Text style={styles.sortOptionTitle}>{option.title}</Text>
                <Text style={styles.sortOptionSubtitle}>{option.subtitle}</Text>
              </View>
              {selected === option.id && (
                <Ionicons name="checkmark-circle" size={22} color={colors.brandDeep} />
              )}
            </Pressable>
          ))}
    </DismissibleBottomSheet>
  );
}

function DismissibleBottomSheet({
  visible,
  onClose,
  onDismissLabel,
  sheetStyle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onDismissLabel: string;
  sheetStyle: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [translateY, visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 4 && gesture.dy > Math.abs(gesture.dx),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.dy > 4 && gesture.dy > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 96 || gesture.vy > 0.85) {
          Animated.timing(translateY, {
            toValue: Dimensions.get('window').height,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.homeSheetOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onDismissLabel}
          onPress={onClose}
          style={styles.homeSheetBackdrop}
        />
        <Animated.View
          style={[sheetStyle, styles.homeSheetElevated, { transform: [{ translateY }] }]}
        >
          <View
            accessibilityLabel="Drag down to close"
            {...panResponder.panHandlers}
            style={styles.homeSheetDragRegion}
          >
            <View style={styles.homeSheetHandle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function compareDivis(a: Divi, b: Divi, sort: SortOption) {
  if (sort === 'created-desc')
    return (
      parseReceiptDate(b.createdAt ?? b.date).getTime() -
      parseReceiptDate(a.createdAt ?? a.date).getTime()
    );
  if (sort === 'date-asc')
    return parseReceiptDate(a.date).getTime() - parseReceiptDate(b.date).getTime();
  if (sort === 'date-desc')
    return parseReceiptDate(b.date).getTime() - parseReceiptDate(a.date).getTime();
  if (sort === 'name-asc') return a.title.localeCompare(b.title);
  if (sort === 'name-desc') return b.title.localeCompare(a.title);
  if (sort === 'price-asc') return a.enteredTotal.minorUnits - b.enteredTotal.minorUnits;
  return b.enteredTotal.minorUnits - a.enteredTotal.minorUnits;
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[$,]/g, '');
}

function searchableDiviText(divi: Divi) {
  const values = [divi.title, divi.date, ...divi.participants.map((person) => person.name)];
  const addMoney = (minorUnits: number, currencyCode: string) => {
    const amount = minorUnits / 100;
    const decimal = amount.toFixed(2);
    values.push(
      formatMoney({ minorUnits, currencyCode }),
      decimal,
      String(Number(decimal)),
      String(minorUnits),
    );
  };
  addMoney(divi.enteredTotal.minorUnits, divi.enteredTotal.currencyCode);
  divi.items.forEach((item) => {
    values.push(item.name);
    addMoney(item.amount.minorUnits, item.amount.currencyCode);
  });
  [divi.tax, divi.tip].forEach((amount) => addMoney(amount.minorUnits, amount.currencyCode));
  [...divi.fees, ...divi.discounts].forEach((adjustment) => {
    values.push(adjustment.name);
    addMoney(adjustment.amount.minorUnits, adjustment.amount.currencyCode);
  });
  divi.allocations.forEach((allocation) =>
    addMoney(allocation.total.minorUnits, allocation.total.currencyCode),
  );
  return normalizeSearch(values.join(' '));
}

function HomeDiviCard({
  divi,
  onPress,
  onMore,
  showMore = true,
  desktop = false,
}: {
  divi: Divi;
  onPress: () => void;
  onMore: () => void;
  showMore?: boolean;
  desktop?: boolean;
}) {
  const dateLabel = homeDateLabel(divi.createdAt, divi.date);
  const creator =
    divi.participants.find(
      (person) => person.userId === divi.creatorId || person.id === divi.creatorId,
    ) ?? divi.participants.find((person) => person.isCurrentUser) ?? divi.participants[0];
  const otherParticipants = divi.participants.filter((person) => {
    const isCreator =
      person.id === creator?.id ||
      (Boolean(person.userId) && person.userId === divi.creatorId) ||
      person.isCurrentUser;
    return !isCreator;
  });
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.homeCard, desktop && styles.homeCardDesktop]}
    >
      <View style={styles.homeCardTop}>
        <View style={styles.homeCardMeta}>
          {divi.state === 'draft' && (
            <>
              <View style={styles.homeCardStatus}>
                <Ionicons name="create-outline" size={14} color={colors.warning} />
                <Text style={styles.homeCardDraftLabel}>Draft</Text>
              </View>
              <View style={styles.homeCardMetaDot} />
            </>
          )}
          {divi.state === 'claiming' && (
            <>
              <View style={styles.homeCardStatus}>
                <Ionicons name="people-outline" size={14} color={colors.brandDeep} />
                <Text style={styles.homeCardClaimingLabel}>Claiming</Text>
              </View>
              <View style={styles.homeCardMetaDot} />
            </>
          )}
          {(divi.state === 'finalized' || divi.state === 'settled') && (
            <>
              <View style={styles.homeCardStatus}>
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.brandDeep} />
                <Text style={styles.homeCardSettledLabel}>Settled</Text>
              </View>
              <View style={styles.homeCardMetaDot} />
            </>
          )}
          <Text style={styles.homeCardDate}>{dateLabel}</Text>
        </View>
        {showMore && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${divi.title}`}
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onMore();
            }}
            style={styles.homeCardMore}
          >
            <Ionicons name="ellipsis-horizontal" size={21} color={colors.secondary} />
          </Pressable>
        )}
      </View>
      <View style={styles.homeCardMain}>
        <View style={styles.homeCardCopy}>
          <HomeCardHeadline
            divi={divi}
            creator={creator}
            otherParticipants={divi.state === 'draft' ? [] : otherParticipants}
          />
        </View>
        <View style={styles.homeMerchantImageWrap}>
          <View accessibilityLabel={`${divi.title} merchant image placeholder`} style={styles.homeMerchantImage}>
            <Ionicons name="restaurant-outline" size={25} color={colors.brandDeep} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function HomeCardHeadline({
  divi,
  creator,
  otherParticipants,
}: {
  divi: Divi;
  creator?: Participant;
  otherParticipants: Participant[];
}) {
  const [bodyWidth, setBodyWidth] = React.useState(0);
  const [avatarWidth, setAvatarWidth] = React.useState(0);
  const [lines, setLines] = React.useState<{ width: number; height: number }[]>([]);
  const hasOthers = otherParticipants.length > 0;
  const totalTextHeight = lines.reduce((sum, line) => sum + line.height, 0);
  const lastLine = lines[lines.length - 1];
  const canShareLastLine = Boolean(
    hasOthers &&
      bodyWidth > 0 &&
      avatarWidth > 0 &&
      lastLine &&
      lastLine.width + 8 + avatarWidth <= bodyWidth,
  );
  const peopleTop = canShareLastLine
    ? totalTextHeight - (lastLine?.height ?? 0) + ((lastLine?.height ?? 0) - 27) / 2
    : totalTextHeight + 4;
  const ready = bodyWidth > 0 && avatarWidth > 0 && lines.length > 0;

  return (
    <View style={styles.homeCardStory}>
      {creator && (
        <ParticipantAvatar
          participant={creator}
          size={27}
          style={styles.homeCardCreatorAvatar}
          initialStyle={styles.homeCardCreatorInitial}
        />
      )}
      <View
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setBodyWidth((current) => (Math.abs(current - width) < 0.5 ? current : width));
        }}
        style={[
          styles.homeCardStoryBody,
          ready && hasOthers && !canShareLastLine && styles.homeCardStoryExtraLine,
        ]}
      >
        <Text
          numberOfLines={3}
          onTextLayout={(event) => {
            const nextLines = event.nativeEvent.lines.map(({ width, height }) => ({ width, height }));
            setLines((current) => {
              const unchanged =
                current.length === nextLines.length &&
                current.every(
                  (line, index) =>
                    Math.abs(line.width - nextLines[index].width) < 0.5 &&
                    Math.abs(line.height - nextLines[index].height) < 0.5,
                );
              return unchanged ? current : nextLines;
            });
          }}
          style={styles.homeCardStoryText}
        >
          <Text style={styles.homeCardStoryName}>{creator?.name ?? 'You'}</Text>
          <Text style={styles.homeCardStoryVerb}>
            {divi.state === 'draft'
              ? ' started a '
              : divi.state === 'claiming'
                ? ' is splitting '
                : ' split '}
          </Text>
          <Text style={styles.homeCardStoryName}>{divi.title}</Text>
          {divi.state === 'draft' ? (
            <Text style={styles.homeCardStoryVerb}> Divi</Text>
          ) : hasOthers ? (
            <Text style={styles.homeCardStoryVerb}> with</Text>
          ) : null}
        </Text>
        {hasOthers && (
          <View
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              setAvatarWidth((current) => (Math.abs(current - width) < 0.5 ? current : width));
            }}
            style={[
              styles.homeCardTrailingParticipants,
              ready
                ? { left: canShareLastLine ? (lastLine?.width ?? 0) + 8 : 0, top: peopleTop }
                : styles.homeCardTrailingParticipantsHidden,
            ]}
          >
            <SmallParticipantAvatars participants={otherParticipants} />
          </View>
        )}
      </View>
    </View>
  );
}

function HomeCardActionsSheet({
  divi,
  onClose,
  onContinue,
  onAdjust,
  onRequestDelete,
}: {
  divi: Divi | null;
  onClose: () => void;
  onContinue: (id: string) => void;
  onAdjust: (id: string) => void;
  onRequestDelete: (divi: Divi) => void;
}) {
  if (!divi) return null;

  return (
    <DismissibleBottomSheet
      visible
      onClose={onClose}
      onDismissLabel="Close Divi actions"
      sheetStyle={styles.homeActionsSheet}
    >
      <View style={styles.homeActionsHeading}>
        <Text numberOfLines={2} style={styles.homeActionsTitle}>{divi.title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Divi actions"
          onPress={onClose}
          style={styles.homeSheetClose}
        >
          <Ionicons name="close" size={21} color={colors.secondary} />
        </Pressable>
      </View>
      <HomeDiviActions
        divi={divi}
        onClose={onClose}
        onContinue={onContinue}
        onAdjust={onAdjust}
        onRequestDelete={onRequestDelete}
      />
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.homeActionCancel}>
        <Text style={styles.homeActionCancelLabel}>Cancel</Text>
      </Pressable>
    </DismissibleBottomSheet>
  );
}

function HomeDiviActions({
  divi,
  onClose,
  onContinue,
  onAdjust,
  onRequestDelete,
}: {
  divi: Divi;
  onClose: () => void;
  onContinue: (id: string) => void;
  onAdjust: (id: string) => void;
  onRequestDelete: (divi: Divi) => void;
}) {
  const canContinue = divi.state === 'draft' || divi.state === 'claiming';
  const actionTitle = canContinue
    ? divi.state === 'draft'
      ? 'Continue draft'
      : 'Continue claiming'
    : 'Adjust';
  const actionIcon: React.ComponentProps<typeof Ionicons>['name'] =
    divi.state === 'draft'
      ? 'create-outline'
      : divi.state === 'claiming'
        ? 'people-outline'
        : 'options-outline';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionTitle}
        onPress={() => {
          onClose();
          if (canContinue) onContinue(divi.id);
          else onAdjust(divi.id);
        }}
        style={styles.homeActionRow}
      >
        <Ionicons name={actionIcon} size={21} color={colors.ink} />
        <Text style={styles.homeActionLabel}>{actionTitle}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${divi.title} receipt`}
        onPress={() => {
          onClose();
          onRequestDelete(divi);
        }}
        style={styles.homeActionRow}
      >
        <Ionicons name="trash-outline" size={21} color={colors.negative} />
        <Text style={styles.homeActionDeleteLabel}>Delete</Text>
      </Pressable>
    </>
  );
}

function DeleteConfirmationSheet({
  divi,
  onCancel,
  onConfirm,
}: {
  divi: Divi | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!divi) return null;

  return (
    <DismissibleBottomSheet
      visible
      onClose={onCancel}
      onDismissLabel="Cancel deletion"
      sheetStyle={styles.homeActionsSheet}
    >
      <Text style={styles.homeSheetTitle}>Delete {divi.title} receipt?</Text>
      <Text style={styles.homeDeleteConfirmCopy}>
        Are you sure you want to delete this receipt?
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onConfirm}
        style={styles.homeDeleteConfirmYes}
      >
        <Text style={styles.homeDeleteConfirmYesLabel}>Delete {divi.title} receipt</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.homeDeleteConfirmNo}
      >
        <Text style={styles.homeDeleteConfirmNoLabel}>No</Text>
      </Pressable>
    </DismissibleBottomSheet>
  );
}

function SmallParticipantAvatars({ participants }: { participants: Participant[] }) {
  const visible = participants.slice(0, 5);
  return (
    <View
      accessibilityLabel={`${participants.length} other participants in this Divi`}
      style={styles.homeAvatars}
    >
      {visible.map((person, index) => (
        <ParticipantAvatar
          key={person.id}
          participant={person}
          size={27}
          style={[styles.homeAvatar, index > 0 && styles.homeAvatarOverlap]}
          initialStyle={styles.homeAvatarInitial}
        />
      ))}
      {participants.length > visible.length && (
        <View style={[styles.homeAvatar, styles.homeAvatarOverlap, styles.homeAvatarMore]}>
          <Text style={styles.homeAvatarInitial}>+{participants.length - visible.length}</Text>
        </View>
      )}
    </View>
  );
}

function FinalBalancesSheet({
  divi,
  onClose,
  onContinue,
  onAdjust,
  onRequestDelete,
}: {
  divi: Divi | null;
  onClose: () => void;
  onContinue: (id: string) => void;
  onAdjust: (id: string) => void;
  onRequestDelete: (divi: Divi) => void;
}) {
  return (
    <DismissibleBottomSheet
      visible={Boolean(divi)}
      onClose={onClose}
      onDismissLabel="Close final balances"
      sheetStyle={styles.homeSheet}
    >
      {divi && (
        <>
            <View style={styles.homeSheetHeader}>
              <View style={styles.homeSheetAvatars}>
                <SmallParticipantAvatars participants={divi.participants} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close final balances"
                onPress={onClose}
                style={styles.homeSheetClose}
              >
                <Ionicons name="close" size={21} color={colors.secondary} />
              </Pressable>
            </View>
            <Text style={styles.homeSheetTitle}>{divi.title}</Text>
            <Text style={styles.homeSheetDate}>
              {parseReceiptDate(divi.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <View style={styles.homeSheetSection}>
              <Text style={styles.homeSheetSectionTitle}>Final balances</Text>
              {divi.allocations.map((allocation) => {
                const person = divi.participants.find(
                  (participant) => participant.id === allocation.participantId,
                );
                if (!person) return null;
                return (
                  <View key={allocation.participantId} style={styles.homeBalanceRow}>
                    <ParticipantAvatar
                      participant={person}
                      size={38}
                      style={styles.homeBalanceAvatar}
                      initialStyle={styles.homeBalanceInitial}
                    />
                    <Text numberOfLines={1} style={styles.homeBalanceName}>
                      {person.name}
                      {person.id === divi.creatorId ? ' · You' : ''}
                    </Text>
                    <Text style={styles.homeBalanceAmount}>{formatMoney(allocation.total)}</Text>
                  </View>
                );
              })}
              {!divi.allocations.length && (
                <Text style={styles.homeSheetEmpty}>No balances are available.</Text>
              )}
            </View>
          <HomeDiviActions
            divi={divi}
            onClose={onClose}
            onContinue={onContinue}
            onAdjust={onAdjust}
            onRequestDelete={onRequestDelete}
          />
        </>
      )}
    </DismissibleBottomSheet>
  );
}

export function ReceiptsScreen({
  divis,
  userId,
  onOpen,
  onAdjust,
  onDelete,
  onRefresh,
  isDesktop = false,
}: {
  divis: Divi[];
  userId: string;
  onOpen: (id: string) => void;
  onAdjust: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => Promise<void>;
  isDesktop?: boolean;
}) {
  const [scope, setScope] = React.useState<'created' | 'shared'>('created');
  const [search, setSearch] = React.useState('');
  const [selectedDivi, setSelectedDivi] = React.useState<Divi | null>(null);
  const [actionDivi, setActionDivi] = React.useState<Divi | null>(null);
  const [deleteConfirmDivi, setDeleteConfirmDivi] = React.useState<Divi | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  const createdDivis = divis.filter((divi) => divi.creatorId === userId);
  const sharedDivis = divis.filter(
    (divi) =>
      divi.creatorId !== userId &&
      divi.participants.some((person) => person.userId === userId || person.isCurrentUser),
  );
  const query = normalizeSearch(search);
  const visibleDivis = (scope === 'created' ? createdDivis : sharedDivis)
    .filter((divi) => !query || searchableDiviText(divi).includes(query))
    .sort((a, b) => compareDivis(a, b, 'created-desc'));
  const requestDelete = (divi: Divi) => {
    setActionDivi(null);
    setSelectedDivi(null);
    setDeleteConfirmDivi(divi);
  };

  return (
    <>
      <View style={styles.receiptsScreenLayout}>
        <View style={styles.homeStickyHeader}>
          <LinearGradient
            pointerEvents="none"
            colors={['#FAFBF9', 'rgba(250,251,249,0.78)', 'rgba(250,251,249,0)']}
            locations={[0, 0.58, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.homeStickyGradient}
          />
          <View
            style={[
              styles.receiptsStickyContent,
              isDesktop && styles.receiptsStickyContentDesktop,
            ]}
          >
            <Text accessibilityRole="header" style={styles.receiptsTitle}>
              Receipts
            </Text>
            <View style={styles.homeSearchBox}>
              <Ionicons name="search" size={19} color={colors.secondary} />
              <TextInput
                accessibilityLabel="Search your receipts"
                placeholder="Search merchants, items, people"
                placeholderTextColor={colors.tertiary}
                returnKeyType="search"
                value={search}
                onChangeText={setSearch}
                style={styles.homeSearchInput}
              />
              {search.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearch('')}
                >
                  <Ionicons name="close-circle" size={19} color={colors.tertiary} />
                </Pressable>
              )}
            </View>
            <View style={styles.receiptsScopeToggle} accessibilityRole="tablist">
              {([
                { id: 'created', title: 'Created', count: createdDivis.length },
                { id: 'shared', title: 'Shared with me', count: sharedDivis.length },
              ] as const).map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: scope === option.id }}
                  onPress={() => setScope(option.id)}
                  style={[
                    styles.receiptsScopeOption,
                    scope === option.id && styles.receiptsScopeOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptsScopeLabel,
                      scope === option.id && styles.receiptsScopeLabelActive,
                    ]}
                  >
                    {option.title}
                  </Text>
                  <Text
                    style={[
                      styles.receiptsScopeCount,
                      scope === option.id && styles.receiptsScopeCountActive,
                    ]}
                  >
                    {option.count}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={[
            styles.homeFeed,
            isDesktop && styles.homeFeedDesktop,
            { paddingTop: isDesktop ? 210 : 190 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              progressViewOffset={isDesktop ? 210 : 190}
              tintColor={colors.brandDeep}
              colors={[colors.brandDeep]}
            />
          }
        >
          {visibleDivis.map((divi) => (
            <HomeDiviCard
              key={divi.id}
              divi={divi}
              onPress={() => setSelectedDivi(divi)}
              onMore={() => setActionDivi(divi)}
              desktop={isDesktop}
            />
          ))}
          {!visibleDivis.length && (
            <Text style={styles.dashboardEmpty}>
              {query
                ? 'No receipts match your search.'
                : scope === 'created'
                  ? 'Receipts you create will appear here.'
                  : 'Receipts shared with you will appear here.'}
            </Text>
          )}
        </ScrollView>
      </View>
      <FinalBalancesSheet
        divi={selectedDivi}
        onClose={() => setSelectedDivi(null)}
        onContinue={onOpen}
        onAdjust={onAdjust}
        onRequestDelete={requestDelete}
      />
      <HomeCardActionsSheet
        divi={actionDivi}
        onClose={() => setActionDivi(null)}
        onContinue={onOpen}
        onAdjust={onAdjust}
        onRequestDelete={requestDelete}
      />
      <DeleteConfirmationSheet
        divi={deleteConfirmDivi}
        onCancel={() => setDeleteConfirmDivi(null)}
        onConfirm={() => {
          if (!deleteConfirmDivi) return;
          onDelete(deleteConfirmDivi.id);
          setDeleteConfirmDivi(null);
        }}
      />
    </>
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

export function ComingSoonScreen() {
  return (
    <View style={styles.comingSoonScreen}>
      <View style={styles.comingSoonIcon}>
        <Ionicons name="time-outline" size={30} color={colors.brandDeep} />
      </View>
      <Text accessibilityRole="header" style={styles.comingSoonTitle}>
        Activity
      </Text>
      <Text style={styles.comingSoonLabel}>Coming soon</Text>
      <Text style={styles.comingSoonCopy}>
        Divi activity will appear here once shared updates are ready.
      </Text>
    </View>
  );
}
export function ProfileScreen({
  user,
  divis,
  onOpen,
  onAdjust,
  onDelete,
  onRefresh,
  onUpdateName,
  onSignOut,
  isDesktop = false,
}: {
  user: User;
  divis: Divi[];
  onOpen: (id: string) => void;
  onAdjust: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => Promise<void>;
  onUpdateName: (name: string) => Promise<void>;
  onSignOut: () => void;
  isDesktop?: boolean;
}) {
  const metadata = user.user_metadata ?? {};
  const initialDisplayName = String(
    metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? 'Divi user',
  );
  const [displayName, setDisplayName] = React.useState(initialDisplayName);
  const [scope, setScope] = React.useState<'created' | 'shared'>('created');
  const [editOpen, setEditOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [selectedDivi, setSelectedDivi] = React.useState<Divi | null>(null);
  const [actionDivi, setActionDivi] = React.useState<Divi | null>(null);
  const [deleteConfirmDivi, setDeleteConfirmDivi] = React.useState<Divi | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [profileImageFailed, setProfileImageFailed] = React.useState(false);
  const avatarUrl = metadata.avatar_url ?? metadata.picture;
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part: string) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const firstName = displayName.trim().split(/\s+/)[0] || 'me';
  const createdDivis = divis.filter((divi) => divi.creatorId === user.id);
  const sharedDivis = divis.filter(
    (divi) =>
      divi.creatorId !== user.id &&
      divi.participants.some((person) => person.userId === user.id || person.isCurrentUser),
  );
  const visibleDivis = (scope === 'created' ? createdDivis : sharedDivis).sort((a, b) =>
    compareDivis(a, b, 'created-desc'),
  );
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  const requestDelete = (divi: Divi) => {
    setActionDivi(null);
    setSelectedDivi(null);
    setDeleteConfirmDivi(divi);
  };

  return (
    <>
      <ScrollView
        style={styles.profileScroll}
        contentContainerStyle={[
          styles.profilePage,
          isDesktop && styles.profilePageDesktop,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.brandDeep}
            colors={[colors.brandDeep]}
          />
        }
      >
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            {avatarUrl && !profileImageFailed ? (
              <Image
                onError={() => setProfileImageFailed(true)}
                source={{ uri: avatarUrl }}
                style={styles.profileAvatarImage}
              />
            ) : (
              <Text style={styles.profileInitial}>{initials}</Text>
            )}
          </View>
          <View style={styles.profileHeaderActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              onPress={() => setEditOpen(true)}
              style={styles.profileHeaderButton}
            >
              <Ionicons name="pencil-outline" size={20} color={colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile settings"
              onPress={() => setSettingsOpen(true)}
              style={styles.profileHeaderButton}
            >
              <Ionicons name="settings-outline" size={21} color={colors.ink} />
            </Pressable>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.profileName}>
          {displayName}
        </Text>
        <View style={styles.profileScopeToggle} accessibilityRole="tablist">
          {([
            { id: 'created', title: 'Created Divis', count: createdDivis.length },
            { id: 'shared', title: `Shared with ${firstName}`, count: sharedDivis.length },
          ] as const).map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === option.id }}
              onPress={() => setScope(option.id)}
              style={[
                styles.profileScopeOption,
                scope === option.id && styles.profileScopeOptionActive,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.profileScopeLabel,
                  scope === option.id && styles.profileScopeLabelActive,
                ]}
              >
                {option.title}
              </Text>
              <Text
                style={[
                  styles.profileScopeCount,
                  scope === option.id && styles.profileScopeCountActive,
                ]}
              >
                {option.count}
              </Text>
            </Pressable>
          ))}
        </View>
        {visibleDivis.length ? (
          <View style={styles.profileDiviList}>
            {visibleDivis.map((divi) => (
              <HomeDiviCard
                key={divi.id}
                divi={divi}
                onPress={() => setSelectedDivi(divi)}
                onMore={() => setActionDivi(divi)}
                showMore={false}
                desktop={isDesktop}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.profileEmpty}>
            {scope === 'created'
              ? 'Divis you create will appear here.'
              : `Divis shared with ${firstName} will appear here.`}
          </Text>
        )}
      </ScrollView>
      <FinalBalancesSheet
        divi={selectedDivi}
        onClose={() => setSelectedDivi(null)}
        onContinue={onOpen}
        onAdjust={onAdjust}
        onRequestDelete={requestDelete}
      />
      <HomeCardActionsSheet
        divi={actionDivi}
        onClose={() => setActionDivi(null)}
        onContinue={onOpen}
        onAdjust={onAdjust}
        onRequestDelete={requestDelete}
      />
      <DeleteConfirmationSheet
        divi={deleteConfirmDivi}
        onCancel={() => setDeleteConfirmDivi(null)}
        onConfirm={() => {
          if (!deleteConfirmDivi) return;
          onDelete(deleteConfirmDivi.id);
          setDeleteConfirmDivi(null);
        }}
      />
      <ProfileEditSheet
        visible={editOpen}
        displayName={displayName}
        email={user.email ?? 'Not provided'}
        onClose={() => setEditOpen(false)}
        onSave={async (name) => {
          await onUpdateName(name);
          setDisplayName(name);
        }}
      />
      <ProfileSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSignOut={onSignOut}
      />
    </>
  );
}

function ProfileEditSheet({
  visible,
  displayName,
  email,
  onClose,
  onSave,
}: {
  visible: boolean;
  displayName: string;
  email: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = React.useState(displayName);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (visible) {
      setName(displayName);
      setError(null);
    }
  }, [displayName, visible]);

  const save = async () => {
    const nextName = name.trim();
    if (!nextName || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(nextName);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update your name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DismissibleBottomSheet
      visible={visible}
      onClose={onClose}
      onDismissLabel="Close edit profile"
      sheetStyle={styles.profileSheet}
    >
      <View style={styles.homeActionsHeading}>
        <Text style={styles.homeActionsTitle}>Edit profile</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close edit profile"
          onPress={onClose}
          style={styles.homeSheetClose}
        >
          <Ionicons name="close" size={21} color={colors.secondary} />
        </Pressable>
      </View>
      <Text style={styles.profileFieldLabel}>Name</Text>
      <TextInput
        accessibilityLabel="Profile name"
        autoCapitalize="words"
        returnKeyType="done"
        value={name}
        onChangeText={setName}
        style={styles.profileEditInput}
      />
      <Text style={styles.profileFieldLabel}>Email</Text>
      <Text numberOfLines={1} style={styles.profileEmailValue}>
        {email}
      </Text>
      {error ? <Text style={styles.profileEditError}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save profile changes"
        disabled={!name.trim() || saving}
        onPress={() => void save()}
        style={[styles.profileSaveButton, (!name.trim() || saving) && styles.profileSaveDisabled]}
      >
        <Text style={styles.profileSaveLabel}>{saving ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>
    </DismissibleBottomSheet>
  );
}

function ProfileSettingsSheet({
  visible,
  onClose,
  onSignOut,
}: {
  visible: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <DismissibleBottomSheet
      visible={visible}
      onClose={onClose}
      onDismissLabel="Close profile settings"
      sheetStyle={styles.profileSheet}
    >
      <View style={styles.homeActionsHeading}>
        <Text style={styles.homeActionsTitle}>Settings</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close profile settings"
          onPress={onClose}
          style={styles.homeSheetClose}
        >
          <Ionicons name="close" size={21} color={colors.secondary} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={onSignOut}
        style={styles.profileSignOutRow}
      >
        <Ionicons name="log-out-outline" size={21} color={colors.negative} />
        <Text style={styles.profileSignOutLabel}>Sign out</Text>
      </Pressable>
    </DismissibleBottomSheet>
  );
}
