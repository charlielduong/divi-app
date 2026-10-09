import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/navigation';
import { ReceiptPeek } from '../components/ReceiptPeek';
import { PrimaryButton } from '../components/ui';
import { allocationItemBreakdown, finalizeAllocations } from '../domain/allocation';
import {
  Allocation,
  Divi,
  formatMoney,
  money,
  Participant,
  ReceiptItem,
  unclaimedAmount,
  unclaimedCount,
} from '../domain/models';
import { createVenmoRequest, VenmoHandoff } from '../services/venmo';
import { appStyles as styles } from '../theme/appStyles';
import { colors } from '../theme/theme';

export function DiviDetailScreen({
  divi,
  onBack,
  onBackToEdit,
  onAdjust,
  onSave,
  onFinalize,
}: {
  divi: Divi;
  onBack: () => void;
  onBackToEdit: () => void;
  onAdjust: () => void;
  onSave: (divi: Divi) => void;
  onFinalize: (divi: Divi) => void;
}) {
  const [local, setLocal] = useState(divi);
  const [invite, setInvite] = useState(false);
  const [addPerson, setAddPerson] = useState(false);
  const [fallback, setFallback] = useState<VenmoHandoff | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>(
    divi.items.map((item) => item.id),
  );

  useEffect(() => {
    setLocal(divi);
  }, [divi]);

  const inviteUrl = `https://divi.example/join/${local.id}`;
  const updateLocal = (next: Divi) => {
    setLocal(next);
  };
  const toggleClaim = (itemId: string, participantId: string) =>
    updateLocal({
      ...local,
      items: local.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              claimantIds: item.claimantIds.includes(participantId)
                ? item.claimantIds.filter((id) => id !== participantId)
                : [...item.claimantIds, participantId],
            }
          : item,
      ),
    });
  const toggleEveryoneClaim = (itemId: string) =>
    updateLocal({
      ...local,
      items: local.items.map((item) => {
        if (item.id !== itemId) return item;
        const everyoneClaimed = local.participants.every((participant) =>
          item.claimantIds.includes(participant.id),
        );
        return {
          ...item,
          claimantIds: everyoneClaimed
            ? item.claimantIds.filter(
                (id) => !local.participants.some((participant) => participant.id === id),
              )
            : local.participants.map((participant) => participant.id),
        };
      }),
    });
  const toggleExpanded = (itemId: string) =>
    setExpandedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((candidate) => candidate !== itemId)
        : [...current, itemId],
    );
  const performFinalize = () => {
    try {
      const finalized = {
        ...local,
        allocations: finalizeAllocations(local),
        state: 'finalized' as const,
      };
      setLocal(finalized);
      onFinalize(finalized);
    } catch (error) {
      Alert.alert(
        'Not ready to finalize',
        error instanceof Error && error.message === 'UNCLAIMED_ITEMS'
          ? 'Every item needs at least one claimant.'
          : 'The receipt must reconcile first.',
      );
    }
  };
  const finalize = () => {
    const remainingItems = unclaimedCount(local);
    if (remainingItems > 0) {
      Alert.alert(
        'Items still unclaimed',
        `${remainingItems} ${remainingItems === 1 ? 'item is' : 'items are'} still unclaimed. Would you still like to finalize?`,
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', style: 'destructive', onPress: performFinalize },
        ],
      );
      return;
    }
    performFinalize();
  };
  const requestVenmo = async (allocation: Allocation, participant: Participant) => {
    const handoff = createVenmoRequest(
      participant,
      money(Math.max(0, allocation.total.minorUnits - allocation.paid.minorUnits)),
      local.title,
    );
    updateLocal({
      ...local,
      allocations: local.allocations.map((item) =>
        item.participantId === allocation.participantId
          ? { ...item, requestInitiated: true }
          : item,
      ),
    });
    if (handoff.url && (await Linking.canOpenURL(handoff.url))) await Linking.openURL(handoff.url);
    else setFallback(handoff);
  };

  const addParticipant = (name: string, phoneNumber: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Add a person', 'Enter a full name to add this person to the Divi.');
      return false;
    }
    updateLocal({
      ...local,
      participants: [
        ...local.participants,
        {
          id: `manual-${Date.now()}`,
          name: trimmedName,
          phoneNumber: phoneNumber.trim() || undefined,
        },
      ],
    });
    return true;
  };

  if (local.state === 'finalized') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <Header title="Final balances" onBack={onAdjust} />
        <ScrollView contentContainerStyle={styles.summaryPage}>
          <View style={styles.summaryHero}>
            <Text style={styles.summaryEyebrow}>{local.title}</Text>
            <Text style={styles.summaryAmount}>{formatMoney(local.enteredTotal)}</Text>
            <Text style={styles.summaryCopy}>Receipt finalized · ready to settle</Text>
          </View>
          <AllocationList divi={local} onRequest={requestVenmo} />
        </ScrollView>
        <View style={styles.finalizeSection}>
          <PrimaryButton title="Done" onPress={onBack} />
        </View>
        {fallback && <FallbackModal handoff={fallback} onClose={() => setFallback(null)} />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Header title={local.title} onBack={onBackToEdit} />
      <View style={styles.detailHero}>
        <View style={styles.detailHeroCopy}>
          <Text style={styles.heroEyebrow}>
            {unclaimedCount(local) === 0 ? 'ALL ITEMS CLAIMED' : 'LEFT TO CLAIM'}
          </Text>
          <Text style={styles.heroAmount}>{formatMoney(unclaimedAmount(local))}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Manage ${local.participants.length} people in this Divi`}
            hitSlop={8}
            onPress={() => setInvite(true)}
            style={styles.heroPeopleAction}
          >
            <ParticipantAvatarGroup participants={local.participants} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open invite for ${local.title}`}
          hitSlop={8}
          onPress={() => setInvite(true)}
          style={styles.heroQrAction}
        >
          <View style={styles.heroQrCard}>
            <QRCode value={inviteUrl} size={72} color={colors.ink} backgroundColor="#FFFFFF" />
          </View>
          <Text style={styles.heroQrLabel}>Invite to Divi</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.detailScrollContent}>
        <View style={styles.listSection}>
          {local.items.map((item) => (
            <ClaimItem
              key={item.id}
              item={item}
              participants={local.participants}
              expanded={expandedItemIds.includes(item.id)}
              onToggleExpanded={() => toggleExpanded(item.id)}
              onToggleClaim={(participantId) => toggleClaim(item.id, participantId)}
              onToggleEveryone={() => toggleEveryoneClaim(item.id)}
              onAddPerson={() => setAddPerson(true)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.finalizeSection}>
        <View style={styles.ctaRow}>
          <SaveProgressButton onPress={() => onSave(local)} />
          <View style={styles.ctaButtonFlex}>
            <PrimaryButton title="Finalize Divi" onPress={finalize} />
          </View>
        </View>
      </View>
      <ReceiptPeek imageUri={local.receiptImageUri} />
      {invite && (
        <InviteModal
          visible
          divi={local}
          onClose={() => setInvite(false)}
          onAddParticipant={addParticipant}
        />
      )}
      {addPerson && (
        <AddPersonModal
          visible
          onClose={() => setAddPerson(false)}
          onAddParticipant={addParticipant}
        />
      )}
      {fallback && <FallbackModal handoff={fallback} onClose={() => setFallback(null)} />}
    </SafeAreaView>
  );
}

function ParticipantAvatarGroup({ participants }: { participants: Participant[] }) {
  const visibleParticipants = participants.slice(0, 4);
  const remaining = participants.length - visibleParticipants.length;
  return (
    <View style={styles.heroPeopleGroup}>
      {visibleParticipants.map((participant, index) => (
        <View
          key={participant.id}
          style={[styles.heroPeopleAvatar, index > 0 && styles.heroPeopleAvatarOverlap]}
        >
          <Text style={styles.heroPeopleInitial}>{participant.name.charAt(0).toUpperCase()}</Text>
        </View>
      ))}
      {remaining > 0 && (
        <View style={[styles.heroPeopleAvatar, styles.heroPeopleAvatarOverlap]}>
          <Text style={styles.heroPeopleInitial}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

function ClaimItem({
  item,
  participants,
  expanded,
  onToggleExpanded,
  onToggleClaim,
  onToggleEveryone,
  onAddPerson,
}: {
  item: ReceiptItem;
  participants: Participant[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleClaim: (participantId: string) => void;
  onToggleEveryone: () => void;
  onAddPerson: () => void;
}) {
  const claimants = participants.filter((participant) => item.claimantIds.includes(participant.id));
  const everyoneClaimed = claimants.length === participants.length && participants.length > 0;
  const claimSummary =
    claimants.length === 0
      ? 'Unclaimed'
      : everyoneClaimed
        ? 'Everyone claimed'
        : `${claimants.length} claiming`;

  return (
    <View style={styles.claimItem}>
      <View style={styles.claimItemSummary}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Hide' : 'Show'} claimants for ${item.name}`}
          onPress={onToggleExpanded}
          style={styles.claimItemDisclosure}
        >
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={[styles.rowSub, claimants.length === 0 && styles.warningText]}>
              {claimSummary}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.secondary}
          />
        </Pressable>
        <Text style={styles.rowValue}>{formatMoney(item.amount)}</Text>
      </View>
      {expanded && (
        <View style={styles.claimantPanel}>
          <Text style={styles.claimantPanelTitle}>Who is claiming this?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.participantRail}
          >
            <ParticipantChoice everyone selected={everyoneClaimed} onPress={onToggleEveryone} />
            {participants.map((participant) => (
              <ParticipantChoice
                key={participant.id}
                participant={participant}
                selected={item.claimantIds.includes(participant.id)}
                onPress={() => onToggleClaim(participant.id)}
              />
            ))}
            <ParticipantChoice addPerson onPress={onAddPerson} />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function ParticipantChoice({
  participant,
  everyone = false,
  addPerson = false,
  selected = false,
  onPress,
}: {
  participant?: Participant;
  everyone?: boolean;
  addPerson?: boolean;
  selected?: boolean;
  onPress: () => void;
}) {
  if (addPerson) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add person to Divi"
        onPress={onPress}
        style={styles.participantChoiceAdd}
      >
        <Ionicons name="add" size={28} color={colors.secondary} />
      </Pressable>
    );
  }

  const label = addPerson
    ? 'Add person'
    : everyone
      ? 'Everyone'
      : participant?.isCurrentUser
        ? 'Me'
        : participant?.name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={addPerson ? undefined : { checked: selected }}
      accessibilityLabel={
        addPerson ? 'Add person to Divi' : `${selected ? 'Remove' : 'Add'} ${label} for this item`
      }
      onPress={onPress}
      style={styles.participantChoice}
    >
      <View style={[styles.participantChoiceCircle, selected && styles.participantChoiceSelected]}>
        {everyone ? (
          <Ionicons
            name="people-outline"
            size={24}
            color={selected ? colors.brandDeep : colors.secondary}
          />
        ) : (
          <Text style={styles.participantChoiceInitial}>{participant?.name.charAt(0)}</Text>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.participantChoiceLabel, selected && styles.participantChoiceLabelSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SaveProgressButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Save Divi progress"
      onPress={onPress}
      style={styles.saveProgressButton}
    >
      <Ionicons name="save-outline" size={24} color={colors.surface} />
    </Pressable>
  );
}

function AllocationList({
  divi,
  onRequest,
}: {
  divi: Divi;
  onRequest: (allocation: Allocation, participant: Participant) => void;
}) {
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<string[]>([]);
  const copyDetails = async (allocation: Allocation, person: Participant) => {
    const detailRows = getAllocationDetailRows(divi, allocation, person.id);
    const details = [
      `${person.name} owes ${formatMoney(allocation.total)} for ${divi.title}`,
      ...detailRows.map(({ label, amount }) => `${label}: ${formatMoney(amount)}`),
      `Total: ${formatMoney(allocation.total)}`,
    ].join('\n');
    await Clipboard.setStringAsync(details);
    Alert.alert('Copied', 'Payment details copied to the clipboard.');
  };

  return (
    <View style={styles.allocation}>
      <Text style={styles.sectionTitle}>Final balances</Text>
      {divi.allocations.map((allocation) => {
        const person = divi.participants.find((item) => item.id === allocation.participantId);
        if (!person) return null;
        const expanded = expandedParticipantIds.includes(person.id);
        const itemBreakdown = allocationItemBreakdown(divi, person.id).filter(
          ({ amount }) => amount.minorUnits !== 0,
        );
        const detailRows = getAllocationDetailRows(divi, allocation, person.id);
        return (
          <View key={allocation.participantId} style={styles.allocationItem}>
            {itemBreakdown.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${expanded ? 'Hide' : 'Show'} details for ${person.name}`}
                onPress={() =>
                  setExpandedParticipantIds((current) =>
                    expanded ? current.filter((id) => id !== person.id) : [...current, person.id],
                  )
                }
                style={styles.allocationHeader}
              >
                <AllocationPersonHeader
                  person={person}
                  creatorId={divi.creatorId}
                  allocation={allocation}
                  itemCount={itemBreakdown.length}
                  expanded={expanded}
                />
              </Pressable>
            ) : (
              <View style={styles.allocationHeader}>
                <AllocationPersonHeader
                  person={person}
                  creatorId={divi.creatorId}
                  allocation={allocation}
                  itemCount={0}
                  expanded={false}
                />
              </View>
            )}
            {itemBreakdown.length === 0 ? (
              <Text style={styles.noItemsHelper}>No items claimed</Text>
            ) : (
              expanded && (
                <View style={styles.allocationDetails}>
                  {detailRows.map(({ label, amount }, index) => (
                    <View key={`${label}-${index}`} style={styles.allocationLine}>
                      <Text style={styles.rowSub}>{label}</Text>
                      <Text style={styles.rowValue}>{formatMoney(amount)}</Text>
                    </View>
                  ))}
                  <View style={styles.paymentActions}>
                    <PaymentRequestButton
                      brand="venmo"
                      title="Venmo"
                      onPress={() => onRequest(allocation, person)}
                    />
                    <PaymentRequestButton
                      brand="apple"
                      title="Apple Cash"
                      onPress={() =>
                        Alert.alert('Apple Cash', 'Apple Cash requests are coming soon.')
                      }
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => copyDetails(allocation, person)}
                    style={styles.secondaryActionButton}
                  >
                    <Text style={styles.secondaryActionLabel}>Copy details</Text>
                  </Pressable>
                </View>
              )
            )}
          </View>
        );
      })}
    </View>
  );
}

function AllocationPersonHeader({
  person,
  creatorId,
  allocation,
  itemCount,
  expanded,
}: {
  person: Participant;
  creatorId: string;
  allocation: Allocation;
  itemCount: number;
  expanded: boolean;
}) {
  return (
    <>
      <View style={styles.allocationAvatar}>
        <Text style={styles.allocationAvatarInitial}>{person.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>
          {person.name}
          {person.id === creatorId ? ' · You' : ''}
        </Text>
        <Text style={styles.rowSub}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <Text style={styles.rowValue}>{formatMoney(allocation.total)}</Text>
      {itemCount > 0 && (
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.secondary}
        />
      )}
    </>
  );
}

function getAllocationDetailRows(divi: Divi, allocation: Allocation, participantId: string) {
  const itemRows = allocationItemBreakdown(divi, participantId)
    .filter(({ amount }) => amount.minorUnits !== 0)
    .map(({ item, amount }) => ({ label: item.name, amount }));
  const chargeRows = [
    { label: 'Tax', amount: allocation.tax },
    { label: 'Tip', amount: allocation.tip },
    { label: 'Fees', amount: allocation.fees },
    { label: 'Discounts', amount: allocation.discounts },
  ].filter(({ amount }) => amount.minorUnits !== 0);
  return [...itemRows, ...chargeRows];
}

function PaymentRequestButton({
  brand,
  title,
  onPress,
}: {
  brand: 'venmo' | 'apple';
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.paymentButton, brand === 'venmo' ? styles.venmoButton : styles.appleButton]}
    >
      {brand === 'venmo' ? (
        <Ionicons name="logo-venmo" size={22} color="#FFFFFF" />
      ) : (
        <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
      )}
      <Text style={styles.paymentButtonLabel}>{title}</Text>
    </Pressable>
  );
}

function InviteModal({
  visible,
  divi,
  onClose,
  onAddParticipant,
}: {
  visible: boolean;
  divi: Divi;
  onClose: () => void;
  onAddParticipant: (name: string, phoneNumber: string) => boolean;
}) {
  const [addingPerson, setAddingPerson] = useState(false);
  const { width } = useWindowDimensions();
  const url = `https://divi.example/join/${divi.id}`;
  const qrSize = Math.min(220, Math.max(160, width - 96));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <Header title="Invite" onBack={onClose} close />
        <ScrollView contentContainerStyle={styles.invitePage}>
          <Text style={styles.pageTitle}>Join {divi.title}</Text>
          <View style={styles.qr}>
            <QRCode value={url} size={qrSize} />
          </View>
          <Text style={styles.centerCopy}>Scan to claim your items.</Text>
          <View style={styles.peopleSection}>
            <View style={styles.peopleSectionHeader}>
              <View style={styles.rowCopy}>
                <Text style={styles.sectionTitle}>People in this Divi</Text>
                <Text style={styles.rowSub}>Add someone if they can’t scan the invite.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add person manually"
                onPress={() => setAddingPerson(true)}
                style={styles.peopleHeaderAction}
              >
                <Ionicons name="person-add-outline" size={18} color={colors.brandDeep} />
              </Pressable>
            </View>
            <View style={styles.peopleRail}>
              {divi.participants.map((participant) => (
                <View key={participant.id} style={styles.peoplePerson}>
                  <View style={styles.peopleAvatar}>
                    <Text style={styles.peopleAvatarInitial}>
                      {participant.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.peopleName}>
                    {participant.name}
                  </Text>
                  <Text style={styles.peopleSource}>{participant.phoneNumber || ''}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.bottomActions}>
            <PrimaryButton title="Share invite" onPress={() => Share.share({ message: url })} />
          </View>
        </ScrollView>
        {addingPerson && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inlineModalBackdrop}
          >
            <Pressable style={styles.modalDismissArea} onPress={() => setAddingPerson(false)} />
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <AddPersonForm
                onClose={() => setAddingPerson(false)}
                onAddParticipant={onAddParticipant}
              />
            </Pressable>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function AddPersonModal({
  visible,
  onClose,
  onAddParticipant,
}: {
  visible: boolean;
  onClose: () => void;
  onAddParticipant: (name: string, phoneNumber: string) => boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalBackdrop}
      >
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <AddPersonForm onClose={onClose} onAddParticipant={onAddParticipant} />
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddPersonForm({
  onClose,
  onAddParticipant,
}: {
  onClose: () => void;
  onAddParticipant: (name: string, phoneNumber: string) => boolean;
}) {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const close = () => {
    Keyboard.dismiss();
    onClose();
  };
  const submit = () => {
    if (onAddParticipant(name, phoneNumber)) close();
  };

  return (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Add person</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close add person form"
          hitSlop={8}
          onPress={close}
        >
          <Ionicons name="close" size={24} color={colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.formHint}>They can be assigned items from your phone.</Text>
      <TextInput
        autoFocus
        accessibilityLabel="Full name"
        placeholder="Full name"
        placeholderTextColor={colors.tertiary}
        onChangeText={setName}
        value={name}
        style={styles.personInput}
      />
      <TextInput
        accessibilityLabel="Phone number"
        keyboardType="phone-pad"
        placeholder="Phone number"
        placeholderTextColor={colors.tertiary}
        onChangeText={setPhoneNumber}
        value={phoneNumber}
        style={styles.personInput}
      />
      <PrimaryButton
        title="Add to Divi"
        onPress={submit}
        onPressIn={Keyboard.dismiss}
        disabled={!name.trim()}
      />
    </>
  );
}
function FallbackModal({
  handoff,
  onClose,
}: {
  handoff: VenmoHandoff | null;
  onClose: () => void;
}) {
  const copy = async () => {
    if (handoff) {
      const recipient = handoff.recipient ? `@${handoff.recipient}` : 'Recipient unavailable';
      const requestDetails = [recipient, handoff.amount, handoff.note].join(' · ');

      await Clipboard.setStringAsync(requestDetails);
    }
    Alert.alert('Copied', 'Request details copied to the clipboard.');
  };
  return (
    <Modal visible={!!handoff} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.sectionTitle}>Request details</Text>
          <Text style={styles.centerCopy}>
            {handoff?.recipient ? `@${handoff.recipient}` : 'Venmo username unavailable'}
          </Text>
          <Text style={styles.fallbackAmount}>{handoff?.amount}</Text>
          <Text style={styles.centerCopy}>{handoff?.note}</Text>
          <PrimaryButton title="Copy request details" onPress={copy} />
          <Pressable onPress={onClose}>
            <Text style={styles.secondaryLink}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
