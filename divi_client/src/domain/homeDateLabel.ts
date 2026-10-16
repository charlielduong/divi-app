import { parseReceiptDate } from './receiptDate';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_RELATIVE_DAYS = 30;

function calendarDateLabel(date: Date, now: number) {
  const currentYear = new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() < currentYear ? { year: 'numeric' as const } : {}),
  });
}

function labelFromCreationTime(createdAt: string, now: number) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const elapsed = Math.max(0, now - created.getTime());
  if (elapsed < MINUTE_MS) return 'Just now';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`;
  if (elapsed < MONTH_RELATIVE_DAYS * DAY_MS) {
    return `${Math.floor(elapsed / DAY_MS)}d`;
  }

  return calendarDateLabel(created, now);
}

function labelFromReceiptDate(receiptDate: string, now: number) {
  const date = parseReceiptDate(receiptDate);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const ageInDays = Math.max(0, Math.floor((todayStart.getTime() - dateStart.getTime()) / DAY_MS));

  if (ageInDays === 0) return 'Today';
  if (ageInDays <= MONTH_RELATIVE_DAYS) return `${ageInDays}d`;
  return calendarDateLabel(date, now);
}

export function homeDateLabel(createdAt?: string, receiptDate?: string, now = Date.now()) {
  if (createdAt) {
    const creationLabel = labelFromCreationTime(createdAt, now);
    if (creationLabel) return creationLabel;
  }
  return receiptDate ? labelFromReceiptDate(receiptDate, now) : '';
}
