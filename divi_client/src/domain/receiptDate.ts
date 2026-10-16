const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseReceiptDate(value: string): Date {
  const match = dateOnlyPattern.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

export function toReceiptDate(value: string): string {
  if (dateOnlyPattern.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function todayReceiptDate(): string {
  return toReceiptDate(new Date().toISOString());
}
