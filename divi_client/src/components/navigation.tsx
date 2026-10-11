import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DiviLogo } from './DiviLogo';
import { formatMoney, Money } from '../domain/models';
import { appStyles as styles } from '../theme/appStyles';
import { colors } from '../theme/theme';

export type TabName = 'home' | 'receipts' | 'activity' | 'profile';

export function DesktopSidebar({
  selected,
  onSelect,
  onCreate,
}: {
  selected: TabName;
  onSelect: (tab: TabName) => void;
  onCreate: () => void;
}) {
  return (
    <View style={styles.desktopSidebar}>
      <View style={styles.desktopBrandRow}>
        <View style={styles.desktopBrandMark}>
          <DiviLogo size={40} accessibilityLabel="Divi logo" />
        </View>
        <Text style={styles.desktopBrand}>Divi</Text>
      </View>

      <View style={styles.desktopNav}>
        <DesktopNavItem
          icon="grid-outline"
          label="Dashboard"
          active={selected === 'home'}
          onPress={() => onSelect('home')}
        />
        <DesktopNavItem
          icon="receipt-outline"
          label="Receipts"
          active={selected === 'receipts'}
          onPress={() => onSelect('receipts')}
        />
        <DesktopNavItem
          icon="time-outline"
          label="Activity"
          active={selected === 'activity'}
          onPress={() => onSelect('activity')}
        />
        <DesktopNavItem
          icon="person-outline"
          label="Profile"
          active={selected === 'profile'}
          onPress={() => onSelect('profile')}
        />
      </View>

      <View style={styles.desktopSidebarFooter}>
        <Pressable onPress={onCreate} style={styles.desktopCreateButton}>
          <Ionicons name="add" size={20} color={colors.surface} />
          <Text style={styles.desktopCreateLabel}>Create Divi</Text>
        </Pressable>
        <Text style={styles.desktopFooterCopy}>Split the receipt. Skip the awkward math.</Text>
      </View>
    </View>
  );
}

function DesktopNavItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.desktopNavItem, active && styles.desktopNavItemActive]}
    >
      <Ionicons name={icon} size={21} color={active ? colors.brandDeep : colors.secondary} />
      <Text style={[styles.desktopNavLabel, active && styles.desktopNavLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function TabBar({
  selected,
  onSelect,
  onCreate,
}: {
  selected: TabName;
  onSelect: (tab: TabName) => void;
  onCreate: () => void;
}) {
  return (
    <View style={styles.tabBar}>
      <Tab
        icon="home-outline"
        label="Home"
        active={selected === 'home'}
        onPress={() => onSelect('home')}
      />
      <Tab
        icon="receipt-outline"
        label="Receipts"
        active={selected === 'receipts'}
        onPress={() => onSelect('receipts')}
      />
      <View style={styles.createTab}>
        <Pressable accessibilityLabel="Create Divi" onPress={onCreate} style={styles.createButton}>
          <Ionicons name="add" size={34} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.tabLabel}>Create Divi</Text>
      </View>
      <Tab
        icon="time-outline"
        label="Activity"
        active={selected === 'activity'}
        onPress={() => onSelect('activity')}
      />
      <Tab
        icon="person-outline"
        label="Profile"
        active={selected === 'profile'}
        onPress={() => onSelect('profile')}
      />
    </View>
  );
}
function Tab({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <Ionicons name={icon} size={25} color={active ? colors.ink : colors.tertiary} />
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </Pressable>
  );
}
export function Header({
  title,
  onBack,
  close,
}: {
  title: string;
  onBack: () => void;
  close?: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name={close ? 'close' : 'arrow-back'} size={28} color={colors.ink} />
      </Pressable>
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      <View style={{ width: 28 }} />
    </View>
  );
}
export function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: Money;
  strong?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.rowSub, strong && styles.rowTitle]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowTitle]}>{formatMoney(value)}</Text>
    </View>
  );
}
