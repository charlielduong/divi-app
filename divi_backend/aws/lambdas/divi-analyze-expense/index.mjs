import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  TextractClient,
  AnalyzeExpenseCommand,
} from "@aws-sdk/client-textract";

const region = process.env.AWS_REGION;

const resultsPrefix = process.env.RESULTS_PREFIX ?? "results/";
const rawPrefix = process.env.RAW_PREFIX ?? "raw/";
const saveRawResponse = process.env.SAVE_RAW_RESPONSE === "true";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const receiptBucket = process.env.RECEIPT_BUCKET;
const maxReceiptBytes = positiveInteger(
  process.env.MAX_RECEIPT_BYTES,
  8 * 1024 * 1024,
);

const s3 = new S3Client({
  region,
});

const textract = new TextractClient({
  region,
});

export const handler = async (event) => {
  const records = event?.Records ?? [];
  let processed = 0;

  for (const record of records) {
    const bucket = record?.s3?.bucket?.name;
    const encodedKey = record?.s3?.object?.key;

    if (!bucket || !encodedKey) {
      console.warn("Skipping malformed S3 event record.");
      continue;
    }

    const key = decodeURIComponent(encodedKey.replace(/\+/g, " "));
    const objectIdentity = parseReceiptObjectKey(key);

    if (!receiptBucket || bucket !== receiptBucket || !objectIdentity) {
      console.warn(
        "Skipping receipt event outside the configured upload boundary.",
      );
      continue;
    }

    const { attemptId } = objectIdentity;

    try {
      await validateReceiptObject(
        bucket,
        key,
        attemptId,
        record?.s3?.object?.size,
      );

      await updateParseAttempt(attemptId, key, {
        status: "processing",
        error_message: null,
      });

      console.log(JSON.stringify({ message: "Analyzing receipt", attemptId }));

      const textractResponse = await textract.send(
        new AnalyzeExpenseCommand({
          Document: {
            S3Object: {
              Bucket: bucket,
              Name: key,
            },
          },
        }),
      );

      const normalizedReceipt = normalizeAnalyzeExpense(textractResponse);

      const outputKey = buildOutputKey(key, resultsPrefix);
      const rawKey = buildOutputKey(key, rawPrefix);

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: outputKey,
          ContentType: "application/json",
          ServerSideEncryption: "AES256",
          Body: JSON.stringify(normalizedReceipt, null, 2),
        }),
      );

      if (saveRawResponse) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: rawKey,
            ContentType: "application/json",
            ServerSideEncryption: "AES256",
            Body: JSON.stringify(textractResponse, null, 2),
          }),
        );
      }

      await updateParseAttempt(attemptId, key, {
        status: "ready",
        result_key: outputKey,
        parsed_receipt: normalizedReceipt,
        completed_at: new Date().toISOString(),
        error_message: null,
      });

      console.log(
        JSON.stringify({
          message: "Saved normalized receipt",
          attemptId,
          rawResponseSaved: saveRawResponse,
        }),
      );
      processed += 1;
    } catch (error) {
      const validationFailure = error instanceof ReceiptValidationError;

      try {
        await updateParseAttempt(attemptId, key, {
          status: "failed",
          error_message: validationFailure
            ? error.publicMessage
            : "Receipt analysis failed. Please try again.",
          completed_at: new Date().toISOString(),
        });
      } catch (statusError) {
        logSafeError(
          "Could not mark receipt analysis as failed",
          attemptId,
          statusError,
        );
      }

      if (validationFailure) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        } catch (deleteError) {
          logSafeError(
            "Could not delete rejected receipt",
            attemptId,
            deleteError,
          );
        }
      }

      logSafeError("Receipt analysis failed", attemptId, error);
    }
  }

  return {
    processed,
    received: records.length,
  };
};

class ReceiptValidationError extends Error {
  constructor(publicMessage) {
    super(publicMessage);
    this.name = "ReceiptValidationError";
    this.publicMessage = publicMessage;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseReceiptObjectKey(key) {
  const match = key.match(
    /^incoming\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/receipt\.jpg$/i,
  );

  return match ? { userId: match[1], attemptId: match[2] } : null;
}

async function validateReceiptObject(bucket, key, attemptId, eventSize) {
  if (Number(eventSize) > maxReceiptBytes) {
    throw new ReceiptValidationError(
      "The receipt image is too large. Please try a smaller image.",
    );
  }

  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  const contentLength = Number(head.ContentLength);

  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > maxReceiptBytes
  ) {
    throw new ReceiptValidationError(
      "The receipt image is too large. Please try a smaller image.",
    );
  }

  if (
    head.ContentType !== "image/jpeg" ||
    head.ServerSideEncryption !== "AES256" ||
    head.Metadata?.["attempt-id"] !== attemptId
  ) {
    throw new ReceiptValidationError(
      "The receipt image could not be validated. Please try again.",
    );
  }

  const object = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: "bytes=0-2",
    }),
  );
  const signature = object.Body
    ? await object.Body.transformToByteArray()
    : new Uint8Array();

  if (
    signature.length !== 3 ||
    signature[0] !== 0xff ||
    signature[1] !== 0xd8 ||
    signature[2] !== 0xff
  ) {
    throw new ReceiptValidationError(
      "The receipt image is not a valid JPEG. Please choose another image.",
    );
  }
}

function logSafeError(message, attemptId, error) {
  console.error(
    JSON.stringify({
      message,
      attemptId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      httpStatusCode: error?.$metadata?.httpStatusCode ?? null,
    }),
  );
}

async function updateParseAttempt(attemptId, sourceKey, patch) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for parse status updates.",
    );
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/receipt_parse_attempts?id=eq.${encodeURIComponent(attemptId)}` +
      `&source_key=eq.${encodeURIComponent(sourceKey)}&select=id`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Could not update receipt parse attempt (${response.status}).`,
    );
  }

  const updatedRows = await response.json();
  if (!Array.isArray(updatedRows) || updatedRows.length !== 1) {
    throw new Error("Receipt parse attempt did not match the uploaded object.");
  }
}

function normalizeAnalyzeExpense(response) {
  const documents = response?.ExpenseDocuments ?? [];

  if (!documents.length) {
    throw new Error("Textract returned no ExpenseDocuments.");
  }

  const summaryFields = documents.flatMap(
    (document) => document.SummaryFields ?? [],
  );

  const items = documents
    .flatMap((document) =>
      (document.LineItemGroups ?? []).flatMap((group) =>
        (group.LineItems ?? []).map((line) =>
          normalizeLineItem(line),
        ),
      ),
    )
    .filter(Boolean);

  const title =
    firstSummaryValue(summaryFields, [
      "VENDOR_NAME",
      "NAME",
    ]) ?? "Scanned receipt";

  const taxMinorUnits = sumSummaryValues(summaryFields, [
    "TAX",
  ]);

  const tipMinorUnits = sumSummaryValues(summaryFields, [
    "TIP",
    "GRATUITY",
  ]);

  const fees = summaryFields
    .filter(isFeeField)
    .map((field) => ({
      name:
        field.LabelDetection?.Text ??
        field.Type?.Text ??
        "Fee",
      amountMinorUnits: parseMoney(
        field.ValueDetection?.Text,
      ),
    }))
    .filter((fee) => fee.amountMinorUnits > 0);

  const discounts = summaryFields
    .filter(isDiscountField)
    .map((field) => ({
      name:
        field.LabelDetection?.Text ??
        field.Type?.Text ??
        "Discount",
      amountMinorUnits: parseMoney(
        field.ValueDetection?.Text,
      ),
    }))
    .filter((discount) => discount.amountMinorUnits > 0);

  const totalMinorUnits =
    firstSummaryAmount(summaryFields, [
      "TOTAL",
      "AMOUNT_DUE",
      "AMOUNT_PAID",
    ]) ?? undefined;

  return {
    title,
    items,
    taxMinorUnits,
    tipMinorUnits,
    fees,
    discounts,
    totalMinorUnits,
  };
}

function normalizeLineItem(line) {
  const fields = line?.LineItemExpenseFields ?? [];

  const itemField = getField(fields, "ITEM");
  const priceField = getField(fields, "PRICE");
  const unitPriceField = getField(fields, "UNIT_PRICE");
  const quantityField = getField(fields, "QUANTITY");
  const rowField = getField(fields, "EXPENSE_ROW");

  const rowText = rowField?.ValueDetection?.Text ?? "";

  const name =
    itemField?.ValueDetection?.Text?.trim() ??
    itemNameFromExpenseRow(rowText);

  if (!name) {
    return null;
  }

  const quantity =
    parseQuantity(quantityField?.ValueDetection?.Text) ?? 1;

  let amountMinorUnits = null;

  // Prefer PRICE when its confidence is reasonable.
  if (
    priceField?.ValueDetection?.Text &&
    (priceField.ValueDetection.Confidence ?? 100) >= 80
  ) {
    amountMinorUnits = parseMoney(
      priceField.ValueDetection.Text,
    );
  }

  // Fallback for low-confidence or malformed PRICE values.
  if (!amountMinorUnits || amountMinorUnits <= 0) {
    amountMinorUnits = parseLastMoney(rowText);
  }

  // Final fallback: UNIT_PRICE multiplied by quantity.
  if (
    (!amountMinorUnits || amountMinorUnits <= 0) &&
    unitPriceField?.ValueDetection?.Text
  ) {
    amountMinorUnits =
      parseMoney(unitPriceField.ValueDetection.Text) *
      quantity;
  }

  if (!amountMinorUnits || amountMinorUnits <= 0) {
    return null;
  }

  return {
    name,
    quantity,
    amountMinorUnits,
  };
}

function getField(fields, type) {
  return fields.find(
    (field) => field?.Type?.Text === type,
  );
}

function firstSummaryValue(fields, types) {
  for (const type of types) {
    const field = fields.find(
      (candidate) =>
        candidate?.Type?.Text === type &&
        candidate?.ValueDetection?.Text,
    );

    if (field) {
      return field.ValueDetection.Text.trim();
    }
  }

  return null;
}

function firstSummaryAmount(fields, types) {
  for (const type of types) {
    const field = fields.find(
      (candidate) =>
        candidate?.Type?.Text === type &&
        candidate?.ValueDetection?.Text,
    );

    if (field) {
      const amount = parseMoney(
        field.ValueDetection.Text,
      );

      if (amount > 0) {
        return amount;
      }
    }
  }

  return null;
}

function sumSummaryValues(fields, types) {
  return fields
    .filter((field) =>
      types.includes(field?.Type?.Text),
    )
    .reduce((sum, field) => {
      return (
        sum +
        parseMoney(field.ValueDetection?.Text)
      );
    }, 0);
}

function isFeeField(field) {
  const type = String(
    field?.Type?.Text ?? "",
  ).toLowerCase();

  const label = String(
    field?.LabelDetection?.Text ?? "",
  ).toLowerCase();

  return (
    type.includes("fee") ||
    type.includes("service_charge") ||
    label.includes("fee") ||
    label.includes("service charge") ||
    label.includes("surcharge") ||
    label.includes("delivery charge")
  );
}

function isDiscountField(field) {
  const type = String(
    field?.Type?.Text ?? "",
  ).toLowerCase();

  const label = String(
    field?.LabelDetection?.Text ?? "",
  ).toLowerCase();

  return (
    type.includes("discount") ||
    type.includes("coupon") ||
    type.includes("rebate") ||
    type.includes("savings") ||
    label.includes("discount") ||
    label.includes("coupon") ||
    label.includes("savings")
  );
}

function parseQuantity(value) {
  if (!value) {
    return null;
  }

  const match = String(value).match(
    /\d+(?:[.,]\d+)?/,
  );

  if (!match) {
    return null;
  }

  const quantity = Number(
    match[0].replace(",", "."),
  );

  return Number.isFinite(quantity) && quantity > 0
    ? quantity
    : null;
}

function parseMoney(value) {
  if (!value) {
    return 0;
  }

  let text = String(value)
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!text) {
    return 0;
  }

  const hasComma = text.includes(",");
  const hasPeriod = text.includes(".");

  if (hasComma && !hasPeriod) {
    text = text.replace(",", ".");
  } else if (hasComma && hasPeriod) {
    text = text.replace(/,/g, "");
  }

  const amount = Number(text);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(Math.abs(amount) * 100);
}

function parseLastMoney(value) {
  if (!value) {
    return 0;
  }

  const matches = String(value).match(
    /(?:[$€£]\s*)?\d+(?:[.,]\d{1,2})?/g,
  );

  if (!matches?.length) {
    return 0;
  }

  return parseMoney(matches[matches.length - 1]);
}

function itemNameFromExpenseRow(rowText) {
  if (!rowText) {
    return null;
  }

  const lines = rowText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const nameLine = lines.find((line) => {
    if (/^\d+(?:[.,]\d+)?$/.test(line)) {
      return false;
    }

    if (/^(?:article|item|sku|product\s*code)\b/i.test(line)) {
      return false;
    }

    if (/^\d+$/.test(line)) {
      return false;
    }

    return /[A-Za-z]/.test(line);
  });

  return nameLine ?? null;
}

function buildOutputKey(sourceKey, prefix) {
  const sourceWithoutIncoming = sourceKey.replace(
    /^incoming\//,
    "",
  );

  const sourceWithoutExtension =
    sourceWithoutIncoming.replace(/\.[^/.]+$/, "");

  return `${prefix}${sourceWithoutExtension}.json`;
}
