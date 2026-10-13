import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { S3Client } from 'npm:@aws-sdk/client-s3@3.1151.0';
import { createPresignedPost } from 'npm:@aws-sdk/s3-presigned-post@3.1151.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const defaultMaxReceiptBytes = 8 * 1024 * 1024;
const uploadExpirySeconds = 5 * 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const configuredMaxReceiptBytes = () => {
  const configured = Number(Deno.env.get('MAX_RECEIPT_BYTES'));
  return Number.isSafeInteger(configured) && configured > 0 ? configured : defaultMaxReceiptBytes;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);

    const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Invalid session.' }, 401);

    const body = await request.json().catch(() => ({}));
    const diviId = typeof body.diviId === 'string' ? body.diviId : null;
    if (diviId && !isUuid(diviId)) return json({ error: 'Invalid Divi ID.' }, 400);

    const { data: attemptRows, error: attemptError } = await supabase.rpc(
      'begin_receipt_parse_attempt',
      { p_divi_id: diviId },
    );

    const attempt = Array.isArray(attemptRows) ? attemptRows[0] : attemptRows;
    const attemptId = attempt?.attempt_id;
    const sourceKey = attempt?.source_key;

    if (attemptError) {
      const isRateLimited = /rate limit/i.test(attemptError.message);
      return json(
        {
          error: isRateLimited
            ? 'Receipt analysis limit reached. Please try again later.'
            : 'Could not start receipt analysis.',
        },
        isRateLimited ? 429 : 400,
      );
    }

    if (typeof attemptId !== 'string' || typeof sourceKey !== 'string') {
      throw new Error('Receipt attempt RPC returned an invalid response.');
    }

    const s3 = new S3Client({
      region: requiredEnv('AWS_REGION'),
      credentials: {
        accessKeyId: requiredEnv('AWS_ACCESS_KEY_ID'),
        secretAccessKey: requiredEnv('AWS_SECRET_ACCESS_KEY'),
        sessionToken: Deno.env.get('AWS_SESSION_TOKEN') || undefined,
      },
    });

    const maxUploadBytes = configuredMaxReceiptBytes();
    const upload = await createPresignedPost(s3, {
      Bucket: requiredEnv('RECEIPT_BUCKET'),
      Key: sourceKey,
      Expires: uploadExpirySeconds,
      Fields: {
        'Content-Type': 'image/jpeg',
        'x-amz-server-side-encryption': 'AES256',
        'x-amz-meta-attempt-id': attemptId,
      },
      Conditions: [
        ['content-length-range', 1, maxUploadBytes],
        { 'Content-Type': 'image/jpeg' },
        { 'x-amz-server-side-encryption': 'AES256' },
        { 'x-amz-meta-attempt-id': attemptId },
      ],
    });

    return json({
      attemptId,
      upload,
      maxUploadBytes,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'Could not start receipt analysis',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return json({ error: 'Could not start receipt analysis.' }, 500);
  }
});
