import {
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

const s3 = new S3Client({
  region,
});

const textract = new TextractClient({
  region,
});

export const handler = async (event) => {
  const records = event?.Records ?? [];

  for (const record of records) {
    const bucket = record?.s3?.bucket?.name;

    const encodedKey = record?.s3?.object?.key;

    if (!bucket || !encodedKey) {
      console.warn("Skipping malformed S3 event record.");
      continue;
    }

    const key = decodeURIComponent(encodedKey.replace(/\+/g, " "));

    if (!key.startsWith("incoming/")) {
      console.log(`Skipping object outside incoming/: ${key}`);
      continue;
    }

    console.log(
      JSON.stringify({
        message: "Analyzing receipt",
        bucket,
        key,
      }),
    );

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

    const normalizedReceipt =
      normalizeAnalyzeExpense(textractResponse);

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

    console.log(
      JSON.stringify({
        message: "Saved normalized receipt",
        bucket,
        sourceKey: key,
        outputKey,
        rawKey: saveRawResponse ? rawKey : null,
        receipt: normalizedReceipt,
      }),
    );
  }

  return {
    processed: records.length,
  };
};

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