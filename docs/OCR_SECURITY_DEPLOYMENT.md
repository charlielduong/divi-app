# OCR security deployment

The receipt pipeline accepts authenticated uploads through a five-minute Amazon S3
presigned POST. Each image is re-encoded as JPEG on the device, capped at 8 MiB,
validated again in Lambda, and then sent to Amazon Textract.

Deploy in this order so the client never calls an API whose database contract is not
ready yet.

## 1. Apply the Supabase migrations

Link the Supabase CLI to the hosted project, review the pending migrations, and push
them:

```sh
cd divi_backend
npx supabase migration list
npx supabase db push
```

`20261013000000_secure_receipt_analysis.sql` removes direct client inserts and adds
`begin_receipt_parse_attempt()`. The RPC allows at most 10 attempts per user in 10
minutes and 50 in 24 hours, serializing concurrent requests per user.

Deploy both Edge Functions after the migration:

```sh
npx supabase functions deploy receipt-analysis-start
npx supabase functions deploy receipt-analysis-status
```

Set these Edge Function secrets. `MAX_RECEIPT_BYTES` must match Lambda and is bytes:

```sh
npx supabase secrets set \
  AWS_REGION=<aws-region> \
  AWS_ACCESS_KEY_ID=<dedicated-upload-signer-key-id> \
  AWS_SECRET_ACCESS_KEY=<dedicated-upload-signer-secret> \
  RECEIPT_BUCKET=<private-receipt-bucket> \
  MAX_RECEIPT_BYTES=8388608
```

If the signer uses temporary credentials, also set `AWS_SESSION_TOKEN` and automate
rotation before expiration. Prefer workload identity or another short-lived credential
mechanism when the Edge Function platform supports it. Otherwise use a dedicated IAM
principal, rotate its access key, and give it only this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SignEncryptedReceiptUploads",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::<private-receipt-bucket>/incoming/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
```

Do not give this principal `s3:GetObject`, `s3:ListBucket`, or access to the
`results/` and `raw/` prefixes.

## 2. Configure the S3 bucket

The bucket must be private, have ACLs disabled with Bucket owner enforced, have all
four Block Public Access settings enabled, use default server-side encryption, and
deny non-TLS requests. The application also includes `AES256` in every upload policy.

The equivalent one-time CLI settings are:

```sh
aws s3api put-public-access-block \
  --bucket <private-receipt-bucket> \
  --public-access-block-configuration \
BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-ownership-controls \
  --bucket <private-receipt-bucket> \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

aws s3api put-bucket-encryption \
  --bucket <private-receipt-bucket> \
  --server-side-encryption-configuration \
'{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

Merge this denial statement into the bucket policy, replacing the bucket placeholder:

```json
{
  "Sid": "DenyInsecureTransport",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:*",
  "Resource": [
    "arn:aws:s3:::<private-receipt-bucket>",
    "arn:aws:s3:::<private-receipt-bucket>/*"
  ],
  "Condition": {
    "Bool": { "aws:SecureTransport": "false" }
  }
}
```

If a browser build uploads receipts, configure CORS for the real application origin.
Native iOS and Android uploads do not need CORS. Do not use `*` for a production web
origin.

```json
[
  {
    "AllowedOrigins": ["https://<app-origin>"],
    "AllowedMethods": ["POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
```

Add lifecycle expiration so abandoned uploads and duplicated OCR output are not kept
indefinitely. A reasonable starting policy is one day for source and raw objects and
seven days for normalized results:

```json
{
  "Rules": [
    {
      "ID": "ExpireIncomingReceipts",
      "Status": "Enabled",
      "Filter": { "Prefix": "incoming/" },
      "Expiration": { "Days": 1 }
    },
    {
      "ID": "ExpireRawTextract",
      "Status": "Enabled",
      "Filter": { "Prefix": "raw/" },
      "Expiration": { "Days": 1 }
    },
    {
      "ID": "ExpireNormalizedResults",
      "Status": "Enabled",
      "Filter": { "Prefix": "results/" },
      "Expiration": { "Days": 7 }
    }
  ]
}
```

Save that document as `receipt-lifecycle.json`, then apply it with:

```sh
aws s3api put-bucket-lifecycle-configuration \
  --bucket <private-receipt-bucket> \
  --lifecycle-configuration file://receipt-lifecycle.json
```

If bucket versioning is enabled, also expire noncurrent versions; otherwise deleted
receipt data remains recoverable and billable.

## 3. Configure the Lambda function

Set these environment variables on `divi-analyze-expense`:

```text
RECEIPT_BUCKET=<private-receipt-bucket>
MAX_RECEIPT_BYTES=8388608
RESULTS_PREFIX=results/
RAW_PREFIX=raw/
SAVE_RAW_RESPONSE=false
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
```

Store the Supabase service-role key as an encrypted Lambda environment variable or in
AWS Secrets Manager and restrict who can read function configuration. Never place it
in Expo or EAS environment variables.

Build and upload the Lambda deployment package from the Lambda directory. A local
ignored `function.zip` has already been rebuilt from the hardened handler, but rebuild
it whenever the handler or dependencies change:

```sh
cd divi_backend/aws/lambdas/divi-analyze-expense
npm ci --omit=dev
zip -qr -FS function.zip index.mjs package.json node_modules
aws lambda update-function-code \
  --function-name divi-analyze-expense \
  --zip-file fileb://function.zip
```

The Lambda execution role needs only these application permissions, scoped to the one
bucket. Keep the standard CloudWatch Logs permissions separately:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadAndRejectIncomingReceipts",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<private-receipt-bucket>/incoming/*"
    },
    {
      "Sid": "WriteReceiptResults",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": [
        "arn:aws:s3:::<private-receipt-bucket>/results/*",
        "arn:aws:s3:::<private-receipt-bucket>/raw/*"
      ]
    },
    {
      "Sid": "AnalyzeReceipts",
      "Effect": "Allow",
      "Action": "textract:AnalyzeExpense",
      "Resource": "*"
    }
  ]
}
```

Set a reserved-concurrency ceiling to limit simultaneous Textract calls. Five is a
safe starting point for early testing; adjust it from observed queueing and spend:

```sh
aws lambda put-function-concurrency \
  --function-name divi-analyze-expense \
  --reserved-concurrent-executions 5
```

Set the CloudWatch log group retention to a short operational window, for example 14
days:

```sh
aws logs put-retention-policy \
  --log-group-name /aws/lambda/divi-analyze-expense \
  --retention-in-days 14
```

## 4. Update the S3 notification

Presigned POST uploads generate `ObjectCreated:Post`, not `ObjectCreated:Put`. Update
the existing notification to invoke the Lambda only for JPEGs under `incoming/`:

```json
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "AnalyzeIncomingReceiptPosts",
      "LambdaFunctionArn": "arn:aws:lambda:<region>:<account-id>:function:divi-analyze-expense",
      "Events": ["s3:ObjectCreated:Post"],
      "Filter": {
        "Key": {
          "FilterRules": [
            { "Name": "prefix", "Value": "incoming/" },
            { "Name": "suffix", "Value": ".jpg" }
          ]
        }
      }
    }
  ]
}
```

Before applying that JSON, merge in any existing bucket notifications because
`put-bucket-notification-configuration` replaces the complete notification
configuration.

After merging, save it as `receipt-notifications.json` and apply it with:

```sh
aws s3api put-bucket-notification-configuration \
  --bucket <private-receipt-bucket> \
  --notification-configuration file://receipt-notifications.json
```

Grant S3 permission to invoke only this Lambda from this bucket and account:

```sh
aws lambda add-permission \
  --function-name divi-analyze-expense \
  --statement-id AllowReceiptBucketInvoke \
  --principal s3.amazonaws.com \
  --action lambda:InvokeFunction \
  --source-arn arn:aws:s3:::<private-receipt-bucket> \
  --source-account <account-id>
```

## 5. Monitoring and spend controls

- Create an AWS Budget for Textract, Lambda, S3, and CloudWatch with alerts well below
  the maximum acceptable monthly spend.
- Alarm on Lambda errors, throttles, and unusual invocation volume, and on unexpected
  S3 `PutRequests` growth.
- Enable CloudTrail S3 data events for the receipt bucket. Data events and retained
  trail logs add charges, so scope them to this bucket and set retention intentionally.
- Enable S3 server access logging to a separate encrypted log bucket with its own
  lifecycle. Access logs add S3 request and storage charges and contain object-key
  metadata, so restrict access to the log bucket.
- Keep `SAVE_RAW_RESPONSE=false` unless raw Textract output is needed temporarily for
  a controlled debugging session.

The pipeline incurs S3 POST, HEAD, ranged GET, PUT, and DELETE requests in addition to
Lambda, Textract, database, CloudWatch, and optional CloudTrail/logging costs. The size
limits, per-user quotas, and Lambda concurrency ceiling bound ordinary abuse but do not
replace account budgets or signup-abuse controls.

## 6. Smoke test

1. Apply the migrations and verify authenticated clients can select their attempts but
   receive permission errors when inserting directly into `receipt_parse_attempts`.
2. Deploy both Edge Functions, update the S3 notification, and deploy the Lambda.
3. Upload a normal receipt and confirm the status reaches `ready`.
4. Confirm CloudWatch logs contain attempt IDs and outcomes only, with no merchant,
   items, prices, bucket names, object keys, or signed URLs.
5. Confirm a non-JPEG or oversized upload is rejected before Textract and that a
   rejected object is deleted.
6. Confirm the eleventh attempt inside ten minutes receives HTTP 429.
