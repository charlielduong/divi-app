import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { recognizeText } from 'expo-ocr-kit';
import { Ionicons } from '@expo/vector-icons';
import { Header, TotalRow } from '../components/navigation';
import { ReceiptPeek } from '../components/ReceiptPeek';
import { PrimaryButton } from '../components/ui';
import {
  calculatedTotal,
  Divi,
  formatMoney,
  money,
  ReceiptAdjustment,
  ReceiptItem,
} from '../domain/models';
import {
  emptyReceiptDraft,
  parseReceiptText,
  receiptDraftFromParsed,
} from '../services/receiptParser';
import { appStyles as styles } from '../theme/appStyles';
import { colors, spacing } from '../theme/theme';

type NamedAdjustmentDraft = ReceiptAdjustment & { amountText: string };
type ItemEditField = 'name' | 'quantity' | 'price';

export function CreateDiviScreen({
  onClose,
  onCreate,
  onSave,
  initialDraft,
}: {
  onClose: () => void;
  onCreate: (divi: Divi) => void;
  onSave: (divi: Divi) => void;
  initialDraft?: Divi;
}) {
  const [stage, setStage] = useState<'source' | 'confirm' | 'parsing' | 'review'>(
    initialDraft ? 'review' : 'source',
  );
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(
    initialDraft?.receiptImageUri ?? null,
  );
  const [draft, setDraft] = useState<Divi | null>(initialDraft ?? null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [parseNotice, setParseNotice] = useState<string | null>(null);

  const selectReceipt = async (source: 'camera' | 'library') => {
    setSourceError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setSourceError(
            'Camera access is needed to photograph a receipt. Enable it in Settings and try again.',
          );
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 1,
            });
      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      setReceiptImageUri(result.assets[0].uri);
      setStage('confirm');
    } catch {
      setSourceError('The receipt image could not be opened. Please try again.');
    }
  };

  const scanReceipt = async () => {
    if (!receiptImageUri) return;
    setStage('parsing');
    setParseNotice(null);
    try {
      const result = await recognizeText(receiptImageUri);
      const parsed = parseReceiptText(result.text, result.blocks);
      setDraft(receiptDraftFromParsed(parsed, receiptImageUri));
      if (parsed.items.length === 0) {
        setParseNotice(
          'No line items were recognized. The image is attached, so you can add the items manually below.',
        );
      } else if (parsed.totalMinorUnits === undefined) {
        setParseNotice('The total was not recognized. Please verify and enter the receipt total.');
      }
      setStage('review');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const needsDevelopmentBuild = /native module|development build|expo go/i.test(message);
      setDraft(emptyReceiptDraft(receiptImageUri));
      setParseNotice(
        needsDevelopmentBuild
          ? 'On-device scanning needs the Divi development build. You can still enter this receipt manually.'
          : 'This image could not be read automatically. You can still enter the receipt manually.',
      );
      setStage('review');
    }
  };

  const startManual = () => {
    setDraft(emptyReceiptDraft());
    setParseNotice('Manual receipt: add each item and enter the printed total.');
    setStage('review');
  };

  const retake = () => {
    setReceiptImageUri(null);
    setStage('source');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Header title="Create Divi" onBack={onClose} close />
      {stage === 'source' && (
        <View style={styles.centerPage}>
          <Ionicons name="scan-outline" size={92} color={colors.brand} />
          <Text style={styles.pageTitle}>Add your receipt</Text>
          <Text style={styles.centerCopy}>
            Photograph a paper receipt or choose a clear image from Photos.
          </Text>
          {sourceError && <Text style={styles.captureError}>{sourceError}</Text>}
          <View style={styles.bottomActions}>
            <PrimaryButton title="Take receipt photo" onPress={() => selectReceipt('camera')} />
            <Pressable accessibilityRole="button" onPress={() => selectReceipt('library')}>
              <Text style={styles.secondaryLink}>Choose from Photos</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={startManual}>
              <Text style={styles.tertiaryLink}>Enter manually</Text>
            </Pressable>
          </View>
        </View>
      )}
      {stage === 'confirm' && receiptImageUri && (
        <View style={styles.receiptConfirmPage}>
          <Image
            accessibilityLabel="Receipt photo preview"
            resizeMode="contain"
            source={{ uri: receiptImageUri }}
            style={styles.receiptConfirmImage}
          />
          <View style={styles.receiptConfirmCopy}>
            <Text style={styles.pageTitle}>Use this photo?</Text>
            <Text style={styles.centerCopy}>
              Make sure the full receipt is visible, upright, and easy to read.
            </Text>
          </View>
          <View style={styles.bottomActions}>
            <PrimaryButton title="Scan receipt" onPress={scanReceipt} />
            <Pressable accessibilityRole="button" onPress={retake}>
              <Text style={styles.secondaryLink}>Retake or choose another</Text>
            </Pressable>
          </View>
        </View>
      )}
      {stage === 'parsing' && (
        <View style={styles.centerPage}>
          <ActivityIndicator color={colors.brandDeep} size="large" />
          <Text style={styles.pageTitle}>Reading your receipt…</Text>
          <Text style={styles.centerCopy}>
            The image stays on this device. You’ll review every item before anyone can claim it.
          </Text>
        </View>
      )}
      {stage === 'review' && draft && (
        <ReceiptReview draft={draft} notice={parseNotice} onConfirm={onCreate} onSave={onSave} />
      )}
    </SafeAreaView>
  );
}

function ReceiptReview({
  draft,
  notice,
  onConfirm,
  onSave,
}: {
  draft: Divi;
  notice: string | null;
  onConfirm: (divi: Divi) => void;
  onSave: (divi: Divi) => void;
}) {
  const [local, setLocal] = useState(draft);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemField, setEditingItemField] = useState<ItemEditField>('name');
  const [itemDraft, setItemDraft] = useState({ name: '', quantity: '1', unitPrice: '' });
  const [itemError, setItemError] = useState<string | null>(null);
  const [swipeActive, setSwipeActive] = useState(false);
  const [moneyDrafts, setMoneyDrafts] = useState({
    tax: (draft.tax.minorUnits / 100).toFixed(2),
    tip: (draft.tip.minorUnits / 100).toFixed(2),
  });
  const [adjustmentDrafts, setAdjustmentDrafts] = useState({
    fees: draft.fees.map((fee) => ({
      ...fee,
      amountText: (fee.amount.minorUnits / 100).toFixed(2),
    })),
    discounts: draft.discounts.map((discount) => ({
      ...discount,
      amountText: (discount.amount.minorUnits / 100).toFixed(2),
    })),
  });
  const subtotalMinorUnits = local.items.reduce((sum, item) => sum + item.amount.minorUnits, 0);
  const receiptTotal = money(calculatedTotal(local));
  const visibleMoneyDrafts = [
    moneyDrafts.tax,
    moneyDrafts.tip,
    ...adjustmentDrafts.fees.map((fee) => fee.amountText),
    ...adjustmentDrafts.discounts.map((discount) => discount.amountText),
  ];
  const adjustmentNamesValid = [...adjustmentDrafts.fees, ...adjustmentDrafts.discounts].every(
    (adjustment) => adjustment.name.trim().length > 0,
  );
  const adjustmentsValid =
    adjustmentNamesValid &&
    visibleMoneyDrafts.every((value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed >= 0;
    });

  const beginEdit = (item: ReceiptItem, field: ItemEditField = 'name') => {
    const quantity = Math.max(1, item.quantity);
    setEditingItemId(item.id);
    setEditingItemField(field);
    setItemDraft({
      name: item.name,
      quantity: String(quantity),
      unitPrice: (item.amount.minorUnits / quantity / 100).toFixed(2),
    });
    setItemError(null);
  };

  const beginAdd = () => {
    setEditingItemId('new');
    setEditingItemField('name');
    setItemDraft({ name: '', quantity: '1', unitPrice: '' });
    setItemError(null);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setItemError(null);
  };

  const saveItem = () => {
    const name = itemDraft.name.trim();
    const quantity = Number.parseInt(itemDraft.quantity, 10);
    const unitPrice = Number.parseFloat(itemDraft.unitPrice);

    if (
      !name ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      setItemError('Enter a name, quantity of at least 1, and a valid price.');
      return;
    }

    const lineAmount = Math.round(unitPrice * 100) * quantity;
    const existingItem = local.items.find((item) => item.id === editingItemId);
    const savedItem: ReceiptItem = {
      id: existingItem?.id ?? `item-${Date.now()}`,
      name,
      quantity,
      amount: money(lineAmount),
      claimantIds: existingItem?.claimantIds ?? [],
    };
    const items = existingItem
      ? local.items.map((item) => (item.id === existingItem.id ? savedItem : item))
      : [...local.items, savedItem];

    setLocal({ ...local, items });
    setEditingItemId(null);
    setItemError(null);
  };

  const removeItem = (itemId: string) => {
    setLocal((current) => {
      if (!current.items.some((item) => item.id === itemId)) return current;
      return { ...current, items: current.items.filter((item) => item.id !== itemId) };
    });
    if (editingItemId === itemId) cancelEdit();
  };

  const updateMoney = (field: 'tax' | 'tip', text: string) => {
    setMoneyDrafts((current) => ({ ...current, [field]: text }));
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    const nextMinorUnits = Math.round(parsed * 100);
    setLocal((current) => ({ ...current, [field]: money(nextMinorUnits) }));
  };

  const addAdjustment = (kind: 'fees' | 'discounts') => {
    const id = `${kind}-${Date.now()}-${adjustmentDrafts[kind].length}`;
    const adjustment = { id, name: '', amount: money(0), amountText: '' };
    setAdjustmentDrafts((current) => ({
      ...current,
      [kind]: [...current[kind], adjustment],
    }));
    setLocal((current) => ({
      ...current,
      [kind]: [...current[kind], { id, name: '', amount: money(0) }],
    }));
  };

  const updateNamedAdjustment = (
    kind: 'fees' | 'discounts',
    id: string,
    patch: { name?: string; amountText?: string },
  ) => {
    setAdjustmentDrafts((current) => ({
      ...current,
      [kind]: current[kind].map((adjustment) =>
        adjustment.id === id ? { ...adjustment, ...patch } : adjustment,
      ),
    }));

    setLocal((current) => {
      const existing = current[kind].find((adjustment) => adjustment.id === id);
      if (!existing) return current;
      const parsed =
        patch.amountText === undefined ? undefined : Number.parseFloat(patch.amountText);
      const nextAmount =
        parsed !== undefined && Number.isFinite(parsed) && parsed >= 0
          ? money(Math.round(parsed * 100))
          : existing.amount;
      const nextName = patch.name ?? existing.name;
      return {
        ...current,
        [kind]: current[kind].map((adjustment) =>
          adjustment.id === id ? { ...adjustment, name: nextName, amount: nextAmount } : adjustment,
        ),
      };
    });
  };

  const removeAdjustment = (kind: 'fees' | 'discounts', id: string) => {
    setAdjustmentDrafts((current) => ({
      ...current,
      [kind]: current[kind].filter((adjustment) => adjustment.id !== id),
    }));
    setLocal((current) => {
      const existing = current[kind].find((adjustment) => adjustment.id === id);
      if (!existing) return current;
      return {
        ...current,
        [kind]: current[kind].filter((adjustment) => adjustment.id !== id),
      };
    });
  };

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!swipeActive}
        onTouchStart={() => {
          if (editingItemId) cancelEdit();
        }}
      >
        {notice && <Text style={styles.scanNotice}>{notice}</Text>}
        <TextInput
          accessibilityLabel="Divi name"
          style={styles.nameInput}
          value={local.title}
          onChangeText={(title) => setLocal({ ...local, title })}
        />
        <View style={styles.receiptItemsHeader}>
          <Text style={styles.receiptItemsTitle}>Items</Text>
        </View>
        {local.items.length === 0 && !editingItemId && (
          <View style={styles.emptyItems}>
            <Ionicons name="receipt-outline" size={32} color={colors.tertiary} />
            <Text style={styles.emptyItemsTitle}>No items yet</Text>
            <Text style={styles.rowSub}>Add the first item from this receipt.</Text>
          </View>
        )}
        {local.items.map((item) =>
          editingItemId === item.id ? (
            <ItemEditor
              key={item.id}
              value={itemDraft}
              focusField={editingItemField}
              error={itemError}
              onChange={setItemDraft}
              onCancel={cancelEdit}
              onSave={saveItem}
              onDelete={() => removeItem(item.id)}
            />
          ) : (
            <SwipeableReceiptItem
              key={item.id}
              item={item}
              onDelete={() => removeItem(item.id)}
              onEdit={(field) => beginEdit(item, field)}
              onSwipeActive={setSwipeActive}
            />
          ),
        )}
        {editingItemId === 'new' && (
          <ItemEditor
            value={itemDraft}
            focusField={editingItemField}
            error={itemError}
            onChange={setItemDraft}
            onCancel={cancelEdit}
            onSave={saveItem}
          />
        )}
        {!editingItemId && (
          <Pressable accessibilityRole="button" onPress={beginAdd} style={styles.addItemButton}>
            <Ionicons name="add-circle" size={21} color={colors.brandDeep} />
            <Text style={styles.addItemLabel}>Add item</Text>
          </Pressable>
        )}
        <View style={styles.totalBlock}>
          <TotalRow label="Subtotal" value={money(subtotalMinorUnits)} />
          <EditableMoneyRow
            label="Tax"
            percentage={percentageFromSubtotal(moneyDrafts.tax, subtotalMinorUnits)}
            value={moneyDrafts.tax}
            onChangeText={(value) => updateMoney('tax', value)}
          />
          <EditableMoneyRow
            label="Tip"
            percentage={percentageFromSubtotal(moneyDrafts.tip, subtotalMinorUnits)}
            value={moneyDrafts.tip}
            onChangeText={(value) => updateMoney('tip', value)}
          />
          {adjustmentDrafts.fees.map((fee) => (
            <NamedAdjustmentRow
              key={fee.id}
              adjustment={fee}
              kind="fee"
              onChange={(patch) => updateNamedAdjustment('fees', fee.id, patch)}
              onRemove={() => removeAdjustment('fees', fee.id)}
            />
          ))}
          {adjustmentDrafts.discounts.map((discount) => (
            <NamedAdjustmentRow
              key={discount.id}
              adjustment={discount}
              kind="discount"
              onChange={(patch) => updateNamedAdjustment('discounts', discount.id, patch)}
              onRemove={() => removeAdjustment('discounts', discount.id)}
            />
          ))}
          <View style={styles.adjustmentActions}>
            <AdjustmentButton label="Add fee" negative onPress={() => addAdjustment('fees')} />
            <AdjustmentButton label="Add discount" onPress={() => addAdjustment('discounts')} />
          </View>
          <TotalRow label="Receipt total" value={receiptTotal} strong />
        </View>
        {!adjustmentsValid && (
          <Text style={styles.warning}>Enter valid tax, tip, fee, and discount details.</Text>
        )}
      </ScrollView>
      <View style={styles.finalizeSection}>
        <View style={styles.ctaRow}>
          <SaveProgressButton
            onPress={() => onSave({ ...local, enteredTotal: receiptTotal, state: 'draft' })}
          />
          <View style={styles.ctaButtonFlex}>
            <PrimaryButton
              disabled={local.items.length === 0 || !adjustmentsValid}
              title="Start claiming"
              onPress={() => onConfirm({ ...local, enteredTotal: receiptTotal, state: 'claiming' })}
            />
          </View>
        </View>
      </View>
      <ReceiptPeek imageUri={draft.receiptImageUri} />
    </>
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

type ItemDraft = { name: string; quantity: string; unitPrice: string };

function ReceiptItemRow({
  item,
  onEdit,
}: {
  item: ReceiptItem;
  onEdit: (field: ItemEditField) => void;
}) {
  return (
    <View style={styles.receiptItemRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit quantity for ${item.name}`}
        onPress={() => onEdit('quantity')}
        style={styles.quantityBadge}
      >
        <Text style={styles.quantityBadgeText}>{item.quantity}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit name for ${item.name}`}
        onPress={() => onEdit('name')}
        style={styles.itemNameTarget}
      >
        <Text numberOfLines={2} style={styles.rowTitle}>
          {item.name}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit price for ${item.name}`}
        onPress={() => onEdit('price')}
        style={styles.itemPriceTarget}
      >
        <Text style={styles.rowValue}>{formatMoney(item.amount)}</Text>
      </Pressable>
    </View>
  );
}

function SwipeableReceiptItem({
  item,
  onEdit,
  onDelete,
  onSwipeActive,
}: {
  item: ReceiptItem;
  onEdit: (field: ItemEditField) => void;
  onDelete: () => void;
  onSwipeActive: (active: boolean) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const gestureStartX = useRef(0);
  const translateRef = useRef(0);
  const close = () => {
    openRef.current = false;
    translateRef.current = 0;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 0,
    }).start(() => onSwipeActive(false));
  };
  const openDelete = () => {
    openRef.current = true;
    translateRef.current = -92;
    Animated.spring(translateX, {
      toValue: -92,
      useNativeDriver: false,
      bounciness: 0,
    }).start(() => onSwipeActive(false));
  };
  const panResponder = useRef(
    PanResponder.create({
      onPanResponderGrant: () => {
        onSwipeActive(true);
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
    <View style={styles.swipeableItem} onTouchStart={(event) => event.stopPropagation()}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.name}`}
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
        <ReceiptItemRow item={item} onEdit={onEdit} />
      </Animated.View>
    </View>
  );
}

function EditableMoneyRow({
  label,
  percentage,
  value,
  onChangeText,
}: {
  label: string;
  percentage: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.editableTotalRow}>
      <View style={styles.editableTotalLabel}>
        <Text style={styles.taxTipLabel}>{label}</Text>
        <Text style={styles.taxTipPercentage}>{percentage}</Text>
      </View>
      <View style={styles.totalInputShell}>
        <Text style={styles.totalInputPrefix}>$</Text>
        <TextInput
          accessibilityLabel={label}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={styles.totalInput}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}

function percentageFromSubtotal(value: string, subtotalMinorUnits: number) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount < 0 || subtotalMinorUnits <= 0) return '—';

  const percentage = (amount * 10000) / subtotalMinorUnits;
  return `${percentage.toFixed(1).replace(/\.0$/, '')}%`;
}

function NamedAdjustmentRow({
  adjustment,
  kind,
  onChange,
  onRemove,
}: {
  adjustment: NamedAdjustmentDraft;
  kind: 'fee' | 'discount';
  onChange: (patch: { name?: string; amountText?: string }) => void;
  onRemove: () => void;
}) {
  const typeLabel = kind === 'fee' ? 'fee' : 'discount';

  return (
    <View style={styles.namedAdjustmentRow}>
      <TextInput
        accessibilityLabel={`${typeLabel} name`}
        placeholder={kind === 'fee' ? 'Service fee' : 'Employee discount'}
        placeholderTextColor={colors.tertiary}
        style={styles.adjustmentNameInput}
        value={adjustment.name}
        onChangeText={(name) => onChange({ name })}
      />
      <View style={[styles.totalInputShell, styles.namedAdjustmentAmount]}>
        {kind === 'discount' && <Text style={styles.totalInputPrefix}>−</Text>}
        <Text style={styles.totalInputPrefix}>$</Text>
        <TextInput
          accessibilityLabel={`${adjustment.name || typeLabel} amount`}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.tertiary}
          selectTextOnFocus
          style={styles.totalInput}
          value={adjustment.amountText}
          onChangeText={(amountText) => onChange({ amountText })}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${adjustment.name || typeLabel}`}
        hitSlop={8}
        onPress={onRemove}
        style={styles.removeAdjustmentButton}
      >
        <Ionicons name="trash-outline" size={20} color={colors.secondary} />
      </Pressable>
    </View>
  );
}

function AdjustmentButton({
  label,
  negative = false,
  onPress,
}: {
  label: string;
  negative?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.adjustmentButton, negative && styles.negativeAdjustmentButton]}
    >
      <Ionicons name="add" size={17} color={negative ? colors.negative : colors.brandDeep} />
      <Text
        style={[styles.adjustmentButtonLabel, negative && styles.negativeAdjustmentButtonLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ItemEditor({
  value,
  focusField,
  error,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: {
  value: ItemDraft;
  focusField: ItemEditField;
  error: string | null;
  onChange: (value: ItemDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const nameInputRef = useRef<TextInput>(null);
  const quantityInputRef = useRef<TextInput>(null);
  const priceInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const inputRef = {
      name: nameInputRef,
      quantity: quantityInputRef,
      price: priceInputRef,
    }[focusField];
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusField]);

  return (
    <View style={styles.itemEditor} onTouchStart={(event) => event.stopPropagation()}>
      <View style={styles.itemEditorHeader}>
        <Text style={[styles.itemEditorTitle, styles.flex]}>{value.name.trim() || 'New item'}</Text>
        {onDelete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${value.name || 'item'}`}
            hitSlop={8}
            onPress={onDelete}
            style={styles.itemEditorDeleteButton}
          >
            <Ionicons name="trash-outline" size={20} color={colors.negative} />
          </Pressable>
        )}
      </View>
      <Text style={styles.inputLabel}>Name</Text>
      <TextInput
        accessibilityLabel="Item name"
        placeholder="Enter item name"
        placeholderTextColor={colors.tertiary}
        ref={nameInputRef}
        style={styles.itemInput}
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
      />
      <View style={styles.itemInputRow}>
        <View style={styles.quantityField}>
          <Text style={styles.inputLabel}>Quantity</Text>
          <TextInput
            accessibilityLabel="Item quantity"
            keyboardType="number-pad"
            ref={quantityInputRef}
            selectTextOnFocus
            style={styles.itemInput}
            value={value.quantity}
            onChangeText={(quantity) => onChange({ ...value, quantity })}
          />
        </View>
        <View style={styles.priceField}>
          <Text style={styles.inputLabel}>Price each</Text>
          <View style={styles.priceInputShell}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              accessibilityLabel="Item price"
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.tertiary}
              ref={priceInputRef}
              style={styles.priceInput}
              value={value.unitPrice}
              onChangeText={(unitPrice) => onChange({ ...value, unitPrice })}
            />
          </View>
        </View>
      </View>
      {error && <Text style={styles.itemError}>{error}</Text>}
      <View style={styles.itemEditorActions}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelItemButton}>
          <Text style={styles.cancelItemLabel}>Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSave} style={styles.saveItemButton}>
          <Text style={styles.saveItemLabel}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}
