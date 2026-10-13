import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Invalid session.' }, 401);

    const { attemptId } = await request.json();
    if (typeof attemptId !== 'string') return json({ error: 'attemptId is required.' }, 400);

    const { data: attempt, error } = await supabase
      .from('receipt_parse_attempts')
      .select('id, status, parsed_receipt, error_message')
      .eq('id', attemptId)
      .eq('user_id', userData.user.id)
      .single();

    if (error || !attempt) return json({ error: 'Receipt analysis not found.' }, 404);

    return json({
      attemptId: attempt.id,
      status: attempt.status,
      parsedReceipt: attempt.parsed_receipt,
      errorMessage: attempt.error_message,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'Could not read receipt analysis',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return json({ error: 'Could not read receipt analysis.' }, 500);
  }
});
