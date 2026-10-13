import type { ParsedReceipt } from './receiptParser';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { supabase } from '../../lib/supabase';

type StartResponse = {
  attemptId: string;
  upload: { url: string; fields: Record<string, string> };
  maxUploadBytes: number;
};
type StatusResponse = {
  attemptId: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  parsedReceipt?: ParsedReceipt | null;
  errorMessage?: string | null;
};

const pollIntervalMs = 750;
const timeoutMs = 45_000;
const maxReceiptDimension = 2048;
const maxReceiptBytes = 8 * 1024 * 1024;

export async function analyzeReceiptRemotely(imageUri: string): Promise<ParsedReceipt> {
  const preparedImage = await prepareReceiptImage(imageUri);

  const imageResponse = await fetch(preparedImage.uri);
  if (!imageResponse.ok) throw new Error('The receipt image could not be read from the device.');

  const imageBlob = await imageResponse.blob();
  if (imageBlob.size < 1 || imageBlob.size > maxReceiptBytes) {
    throw new Error('The prepared receipt image is too large. Please choose a smaller image.');
  }

  const { data: start, error: startError } = await supabase.functions.invoke<StartResponse>(
    'receipt-analysis-start',
    { body: {} },
  );
  if (
    startError ||
    !start?.attemptId ||
    !start.upload?.url ||
    !start.upload.fields ||
    !Number.isSafeInteger(start.maxUploadBytes)
  ) {
    throw new Error(startError?.message ?? 'Could not start receipt analysis.');
  }

  if (imageBlob.size > start.maxUploadBytes) {
    throw new Error('The prepared receipt image is too large. Please choose a smaller image.');
  }

  const uploadBody = new FormData();
  for (const [name, value] of Object.entries(start.upload.fields)) {
    uploadBody.append(name, value);
  }
  uploadBody.append('file', imageBlob, 'receipt.jpg');

  const uploadResponse = await fetch(start.upload.url, {
    method: 'POST',
    body: uploadBody,
  });
  if (!uploadResponse.ok) throw new Error(`The receipt upload failed (${uploadResponse.status}).`);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data: status, error: statusError } = await supabase.functions.invoke<StatusResponse>(
      'receipt-analysis-status',
      { body: { attemptId: start.attemptId } },
    );
    if (statusError) throw new Error(statusError.message);
    if (status?.status === 'ready' && status.parsedReceipt) return status.parsedReceipt;
    if (status?.status === 'failed') {
      throw new Error(status.errorMessage ?? 'Receipt analysis failed.');
    }
    await delay(pollIntervalMs);
  }

  throw new Error('Receipt analysis timed out. Please try again or enter it manually.');
}

async function prepareReceiptImage(uri: string) {
  const { width, height } = await Image.getSize(uri);
  const largestDimension = Math.max(width, height);
  const actions: ImageManipulator.Action[] = [];

  if (largestDimension > maxReceiptDimension) {
    actions.push(
      width >= height
        ? { resize: { width: maxReceiptDimension } }
        : { resize: { height: maxReceiptDimension } },
    );
  }

  return ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
