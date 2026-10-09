import { currentUser, Divi, money, ReceiptAdjustment, ReceiptItem } from '../domain/models';

export type ParsedReceipt = {
  title: string;
  items: Array<{ name: string; quantity: number; amountMinorUnits: number }>;
  taxMinorUnits: number;
  tipMinorUnits: number;
  fees: Array<{ name: string; amountMinorUnits: number }>;
  discounts: Array<{ name: string; amountMinorUnits: number }>;
  totalMinorUnits?: number;
};

type MoneyMatch = {
  amountMinorUnits: number;
  prefix: string;
};

export type ReceiptOcrBlock = {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
};

const moneyAtEnd = /(?:^|\s)([-−]?\s*\$?\s*\(?\d{1,6}(?:,\d{3})*(?:\.\d{2})\)?-?)\s*$/;
const metadataPattern =
  /\b(?:receipt|invoice|order|check|table|server|guest|customer|phone|tel|www\.|https?:|thank|welcome|address|store\s*#|transaction|terminal|approval|auth|date|time)\b/i;
const paymentPattern =
  /\b(?:cash|visa|mastercard|amex|discover|credit|debit|tender|change|payment|paid|card|gift card)\b/i;
const webOrIdentifierPattern =
  /(?:\b[a-z0-9-]+\.(?:com|net|org|io|co)\b|\b\+?\d[\d().\s-]{7,}\d\b|\b\d{5}(?:-\d{4})?\b|\b(?:order\s*#?|invoice\s*(?:number|#)?|receipt\s*#?)\b)/i;
const merchantMarketingPattern =
  /\b(?:every day|you get|thank you|welcome to|enjoyed your experience|let others know|leave us a review|scan the qr|visit us)\b/i;

function normalizeLine(value: string) {
  return value
    .replace(/[|]/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoneyAtEnd(line: string): MoneyMatch | null {
  // Grocery receipts often append a tax category (for example `4.99 B`) or
  // mark a line discount as `0.50-B`. Treat that suffix as receipt metadata.
  const valueLine = line.replace(/\s+(?:FT|[BT])$/i, '').replace(/([\d])-[BT]$/i, '$1-');
  const match = valueLine.match(moneyAtEnd);
  if (!match || match.index === undefined) return null;

  const token = match[1];
  const negative = /^\s*[-−]/.test(token) || /\(.*\)/.test(token) || /-\s*$/.test(token);
  const numeric = Number.parseFloat(token.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric)) return null;

  return {
    amountMinorUnits: Math.round(numeric * 100) * (negative ? -1 : 1),
    prefix: valueLine.slice(0, match.index).trim(),
  };
}

function cleanLabel(value: string, fallback: string) {
  const label = value
    .replace(/^[-*:]+|[-*:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return label || fallback;
}

function displayName(value: string) {
  const cleaned = cleanLabel(value, 'Scanned receipt');
  if (cleaned !== cleaned.toUpperCase() || cleaned.length < 4) return cleaned;
  return cleaned.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function extractItem(prefix: string, amountMinorUnits: number) {
  // Keep the item label exactly as the receipt/OCR presents it. Receipt
  // formats encode quantities, unit prices, weights, modifiers, and product
  // codes in many incompatible ways. The one exception is an explicit
  // quantity at the start of the row; expose that quantity to the review UI,
  // but leave every other part of the label untouched. The trailing amount is
  // the line total; do not try to interpret the rest of the label.
  let name = cleanLabel(prefix, 'Receipt item');
  let quantity = 1;
  const leadingQuantity = name.match(/^(\d+)\s*(?:[xX@]\s*)?(.+)$/);
  if (leadingQuantity) {
    const parsedQuantity = Number.parseInt(leadingQuantity[1], 10);
    if (parsedQuantity >= 1 && parsedQuantity <= 99) {
      quantity = parsedQuantity;
      name = leadingQuantity[2].trim();
    }
  }

  return {
    name,
    quantity,
    amountMinorUnits: Math.abs(amountMinorUnits),
  };
}

function isPlausibleItemName(line: string) {
  return (
    /[A-Za-z]/.test(line) &&
    line.length >= 2 &&
    line.length <= 80 &&
    !metadataPattern.test(line) &&
    !paymentPattern.test(line) &&
    !webOrIdentifierPattern.test(line) &&
    !/^\d+[\s-]*$/.test(line)
  );
}

function merchantCandidate(line: string) {
  const candidate = normalizeLine(line);
  return (
    isPlausibleItemName(candidate) &&
    !parseMoneyAtEnd(candidate) &&
    !/^\d+\s+.*\b(?:street|st\.?|drive|dr\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|highway|hwy\.?|parkway|pkwy\.?|court|ct\.?|way)\b/i.test(
      candidate,
    ) &&
    !/\b(?:op\s*#|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i.test(candidate) &&
    !merchantMarketingPattern.test(candidate) &&
    !/\b(?:subtotal|total|tax|tip|fee)\b/i.test(candidate)
  );
}

function firstMerchantLine(lines: string[], blocks: ReceiptOcrBlock[] = []) {
  const candidates = lines.filter(merchantCandidate);
  if (!blocks.length) return candidates[0] ? displayName(candidates[0]) : 'Scanned receipt';

  const positionedBlocks = blocks.flatMap((block) => {
    const blockLines = block.text.split(/\r?\n/).map(normalizeLine).filter(Boolean);
    const lineHeight = block.boundingBox.height / Math.max(1, blockLines.length);
    return blockLines.map((text, index) => ({
      text,
      boundingBox: {
        ...block.boundingBox,
        y: block.boundingBox.y + lineHeight * index,
        height: lineHeight,
      },
    }));
  });

  const typicalWidth = median(positionedBlocks.map(({ boundingBox }) => boundingBox.width));
  const typicalHeight = median(positionedBlocks.map(({ boundingBox }) => boundingBox.height));
  const rotated = typicalHeight > typicalWidth * 2;
  const rowCenter = (boundingBox: ReceiptOcrBlock['boundingBox']) =>
    rotated ? -(boundingBox.x + boundingBox.width / 2) : boundingBox.y + boundingBox.height / 2;
  const columnCenter = (boundingBox: ReceiptOcrBlock['boundingBox']) =>
    rotated ? boundingBox.y + boundingBox.height / 2 : boundingBox.x + boundingBox.width / 2;
  const lineThickness = (boundingBox: ReceiptOcrBlock['boundingBox']) =>
    rotated ? boundingBox.width : boundingBox.height;
  const contentTop = Math.min(...positionedBlocks.map(({ boundingBox }) => rowCenter(boundingBox)));
  const contentBottom = Math.max(
    ...positionedBlocks.map(({ boundingBox }) => rowCenter(boundingBox)),
  );
  const contentLeft = Math.min(
    ...positionedBlocks.map(({ boundingBox }) => (rotated ? boundingBox.y : boundingBox.x)),
  );
  const contentRight = Math.max(
    ...positionedBlocks.map(({ boundingBox }) =>
      rotated ? boundingBox.y + boundingBox.height : boundingBox.x + boundingBox.width,
    ),
  );
  const contentHeight = Math.max(1, contentBottom - contentTop);
  const contentWidth = Math.max(1, contentRight - contentLeft);
  const topHalfBoundary = contentTop + contentHeight / 2;
  const typicalThickness =
    median(positionedBlocks.map(({ boundingBox }) => lineThickness(boundingBox))) || 1;
  const firstPriceRow = Math.min(
    ...positionedBlocks
      .filter(({ text }) => parseMoneyAtEnd(normalizeLine(text)))
      .map(({ boundingBox }) => rowCenter(boundingBox)),
    contentBottom,
  );

  const ranked = positionedBlocks
    .map(({ text, boundingBox }) => {
      const line = normalizeLine(text);
      if (!merchantCandidate(line)) return null;

      const row = rowCenter(boundingBox);
      if (row > topHalfBoundary) return null;

      const centerX = columnCenter(boundingBox);
      const receiptCenterX = contentLeft + contentWidth / 2;
      const centered =
        1 - Math.min(1, Math.abs(centerX - receiptCenterX) / (contentWidth / 2 || 1));
      const letterCount = line.match(/[A-Za-z]/g)?.length || 1;
      const uppercaseRatio = (line.match(/[A-Z]/g)?.length ?? 0) / letterCount;
      const heightRatio = lineThickness(boundingBox) / typicalThickness;
      const relativeY = (row - contentTop) / contentHeight;
      const beforeItems = row < firstPriceRow;
      const score =
        Math.min(line.length, 32) / 32 +
        centered * 1.5 +
        uppercaseRatio * 1.5 +
        Math.min(heightRatio, 2.5) * 0.7 +
        (beforeItems ? 1 : -1) -
        relativeY * 1.2;
      return { line, score };
    })
    .filter((candidate): candidate is { line: string; score: number } => candidate !== null)
    .sort((a, b) => b.score - a.score);

  const chosen = ranked[0]?.line ?? candidates[0];
  return chosen ? displayName(chosen) : 'Scanned receipt';
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Reconstruct receipt rows when OCR returns the label and amount columns as
 * separate observations. Some camera images carry rotation metadata that
 * causes the native OCR boxes to arrive rotated: in that shape, x describes
 * the visual row and y describes the visual column.
 */
function receiptLinesFromBlocks(blocks: ReceiptOcrBlock[]) {
  const positioned = blocks
    .map((block, index) => ({
      index,
      text: normalizeLine(block.text),
      boundingBox: block.boundingBox,
    }))
    .filter(({ text, boundingBox }) =>
      Boolean(
        text &&
        Number.isFinite(boundingBox.x) &&
        Number.isFinite(boundingBox.y) &&
        boundingBox.width > 0 &&
        boundingBox.height > 0,
      ),
    );
  if (positioned.length < 2) return null;

  const typicalWidth = median(positioned.map(({ boundingBox }) => boundingBox.width));
  const typicalHeight = median(positioned.map(({ boundingBox }) => boundingBox.height));
  const rotated = typicalHeight > typicalWidth * 2;
  const rowTolerance = Math.max(8, (rotated ? typicalWidth : typicalHeight) * 0.9);
  const rowStart = ({ boundingBox }: (typeof positioned)[number]) =>
    rotated ? boundingBox.x : boundingBox.y;
  const columnStart = ({ boundingBox }: (typeof positioned)[number]) =>
    rotated ? boundingBox.y : boundingBox.x;
  const likelyItemLabels = positioned.filter(
    ({ text }) =>
      text.length >= 5 &&
      /[A-Za-z]/.test(text) &&
      !/^(?:WT|SC)\b/i.test(text) &&
      !parseMoneyAtEnd(text) &&
      !metadataPattern.test(text),
  );
  const itemColumnTolerance = Math.max(12, typicalWidth * 1.25);
  const itemColumnClusters = likelyItemLabels.map(({ boundingBox }) => {
    const start = rotated ? boundingBox.y : boundingBox.x;
    const cluster = likelyItemLabels.filter(({ boundingBox: otherBox }) => {
      const otherStart = rotated ? otherBox.y : otherBox.x;
      return Math.abs(otherStart - start) <= itemColumnTolerance;
    });
    return { start, count: cluster.length };
  });
  const itemStartColumn = [...itemColumnClusters].sort((a, b) => b.count - a.count)[0]?.start;

  const priceBlocks = positioned.filter(({ text }) => {
    const moneyMatch = parseMoneyAtEnd(text);
    return Boolean(moneyMatch && !moneyMatch.prefix);
  });
  const priceIndexes = new Set(priceBlocks.map(({ index }) => index));
  const usedLabelIndexes = new Set<number>();
  const matchedPriceIndexes = new Set<number>();
  const reconstructed: Array<{
    text: string;
    row: number;
    column: number;
    index: number;
  }> = [];

  priceBlocks.forEach((priceBlock) => {
    const candidates = positioned
      .filter((candidate) => {
        if (priceIndexes.has(candidate.index) || usedLabelIndexes.has(candidate.index))
          return false;
        if (!/[A-Za-z]/.test(candidate.text)) return false;
        if (columnStart(candidate) >= columnStart(priceBlock)) return false;
        const candidateAmount = parseMoneyAtEnd(priceBlock.text)?.amountMinorUnits ?? 0;
        if (
          candidateAmount >= 0 &&
          itemStartColumn !== undefined &&
          Math.abs(columnStart(candidate) - itemStartColumn) > itemColumnTolerance
        )
          return false;

        const delta = rowStart(priceBlock) - rowStart(candidate);
        return rotated ? delta >= 0 && delta <= rowTolerance : Math.abs(delta) <= rowTolerance;
      })
      .sort((left, right) => {
        const leftDelta = Math.abs(rowStart(priceBlock) - rowStart(left));
        const rightDelta = Math.abs(rowStart(priceBlock) - rowStart(right));
        return leftDelta - rightDelta || right.text.length - left.text.length;
      });

    const labelBlock = candidates[0];
    if (!labelBlock) return;

    usedLabelIndexes.add(labelBlock.index);
    matchedPriceIndexes.add(priceBlock.index);
    reconstructed.push({
      text: `${labelBlock.text} ${priceBlock.text}`,
      row: rowStart(labelBlock),
      column: columnStart(labelBlock),
      index: labelBlock.index,
    });
  });

  // Require more than one row match before preferring block geometry over the
  // OCR engine's full-text ordering. A single accidental alignment should not
  // change otherwise usable text parsing.
  if (reconstructed.length < 2) return null;

  positioned.forEach((block) => {
    if (usedLabelIndexes.has(block.index) || matchedPriceIndexes.has(block.index)) return;
    reconstructed.push({
      text: block.text,
      row: rowStart(block),
      column: columnStart(block),
      index: block.index,
    });
  });

  reconstructed.sort((left, right) => {
    const rowDifference = rotated ? right.row - left.row : left.row - right.row;
    if (Math.abs(rowDifference) > rowTolerance / 2) return rowDifference;
    const columnDifference = left.column - right.column;
    return columnDifference || left.index - right.index;
  });

  return coalesceReceiptLines(reconstructed.map(({ text }) => text).join('\n'));
}

function coalesceReceiptLines(rawText: string) {
  const sourceLines = rawText.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const lines: string[] = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index];
    const nextLine = sourceLines[index + 1];
    const currentMoney = parseMoneyAtEnd(line);
    const nextMoney = nextLine ? parseMoneyAtEnd(nextLine) : null;
    const nextIsPriceOnly = Boolean(nextMoney && !nextMoney.prefix);

    // Vision commonly emits receipt columns as separate observations. Rejoin
    // a label or item with the amount on the same visual row.
    if (nextIsPriceOnly && (!currentMoney || currentMoney.prefix)) {
      lines.push(`${line} ${nextLine}`);
      index += 1;
      continue;
    }

    lines.push(line);
  }

  return lines;
}

export function parseReceiptText(rawText: string, blocks: ReceiptOcrBlock[] = []): ParsedReceipt {
  const blockLines = receiptLinesFromBlocks(blocks);
  const lines = blockLines ?? coalesceReceiptLines(rawText);
  const parsed: ParsedReceipt = {
    title: firstMerchantLine(lines, blocks),
    items: [],
    taxMinorUnits: 0,
    tipMinorUnits: 0,
    fees: [],
    discounts: [],
  };
  let pendingItemName: string | null = null;

  lines.forEach((line) => {
    // Store receipts often print the regular shelf price and savings as
    // indented annotations beneath the actual item. These are not purchased
    // line items (and the displayed savings may not be a separate adjustment
    // to the receipt total), so discard the whole annotation row.
    if (
      /^(?:reg\b|regular\s+price\b|savings?\s+with\s+prime\b|you\s+saved\b|total\s+savings\b)/i.test(
        line,
      )
    ) {
      pendingItemName = null;
      return;
    }

    const moneyMatch = parseMoneyAtEnd(line);

    if (!moneyMatch) {
      if (isPlausibleItemName(line) && line !== lines[0]) pendingItemName = line;
      return;
    }

    const amount = moneyMatch.amountMinorUnits;
    const prefix = moneyMatch.prefix;
    const classification = prefix.toLowerCase();

    if (/\bsub\s*total\b/.test(classification)) {
      pendingItemName = null;
      return;
    }
    if (/\b(?:grand\s+total|amount\s+due|balance(?:\s+due)?|net\s+sales|total)\b/.test(classification)) {
      parsed.totalMinorUnits = Math.abs(amount);
      pendingItemName = null;
      return;
    }
    if (/\b(?:sales\s+)?tax\b/.test(classification)) {
      parsed.taxMinorUnits += Math.abs(amount);
      pendingItemName = null;
      return;
    }
    if (/\b(?:tip|gratuity)\b/.test(classification)) {
      parsed.tipMinorUnits = Math.abs(amount);
      pendingItemName = null;
      return;
    }
    if (/\b(?:discount|coupon|promo|savings|markdown)\b/.test(classification)) {
      parsed.discounts.push({
        name: cleanLabel(prefix, 'Discount'),
        amountMinorUnits: Math.abs(amount),
      });
      pendingItemName = null;
      return;
    }
    if (/\b(?:fee|service\s+charge|delivery\s+charge|surcharge)\b/.test(classification)) {
      parsed.fees.push({
        name: displayName(prefix),
        amountMinorUnits: Math.abs(amount),
      });
      pendingItemName = null;
      return;
    }
    if (amount < 0) {
      parsed.discounts.push({
        name: cleanLabel(prefix, 'Discount'),
        amountMinorUnits: Math.abs(amount),
      });
      pendingItemName = null;
      return;
    }
    if (paymentPattern.test(classification) || metadataPattern.test(classification)) {
      pendingItemName = null;
      return;
    }

    const itemPrefix = prefix || pendingItemName;
    if (itemPrefix && isPlausibleItemName(itemPrefix) && amount > 0) {
      parsed.items.push(extractItem(itemPrefix, amount));
    }
    pendingItemName = null;
  });

  return parsed;
}

function adjustments(
  kind: 'fee' | 'discount',
  values: Array<{ name: string; amountMinorUnits: number }>,
): ReceiptAdjustment[] {
  return values.map((value, index) => ({
    id: `${kind}-${index}-${Date.now()}`,
    name: value.name,
    amount: money(value.amountMinorUnits),
  }));
}

export function receiptDraftFromParsed(parsed: ParsedReceipt, receiptImageUri?: string): Divi {
  const items: ReceiptItem[] = parsed.items.map((item, index) => ({
    id: `item-${index}-${Date.now()}`,
    name: item.name,
    quantity: item.quantity,
    amount: money(item.amountMinorUnits),
    claimantIds: [],
  }));
  const fees = adjustments('fee', parsed.fees);
  const discounts = adjustments('discount', parsed.discounts);
  const calculatedMinorUnits =
    items.reduce((sum, item) => sum + item.amount.minorUnits, 0) +
    parsed.taxMinorUnits +
    parsed.tipMinorUnits +
    fees.reduce((sum, fee) => sum + fee.amount.minorUnits, 0) -
    discounts.reduce((sum, discount) => sum + discount.amount.minorUnits, 0);

  return {
    id: `divi-${Date.now()}`,
    title: parsed.title,
    date: new Date().toISOString(),
    state: 'draft',
    creatorId: currentUser.id,
    payerId: currentUser.id,
    participants: [currentUser],
    items,
    tax: money(parsed.taxMinorUnits),
    tip: money(parsed.tipMinorUnits),
    fees,
    discounts,
    enteredTotal: money(parsed.totalMinorUnits ?? calculatedMinorUnits),
    allocations: [],
    receiptImageUri,
  };
}

export function emptyReceiptDraft(receiptImageUri?: string) {
  return receiptDraftFromParsed(
    {
      title: 'New receipt',
      items: [],
      taxMinorUnits: 0,
      tipMinorUnits: 0,
      fees: [],
      discounts: [],
      totalMinorUnits: 0,
    },
    receiptImageUri,
  );
}
