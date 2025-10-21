import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const METIS_API_KEY = Deno.env.get('METIS_API_KEY');
const METIS_BOT_ID = Deno.env.get('METIS_BOT_ID');
const METIS_BASE_URL = 'https://api.metisai.ir/api/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();

    if (!question || !question.trim()) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating Metis session...');
    console.log('Using Bot ID:', METIS_BOT_ID);
    
    // Step 1: Create session
    const sessionResponse = await fetch(`${METIS_BASE_URL}/chat/session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${METIS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        botId: METIS_BOT_ID,
        user: null,
        initialMessages: [
          {
            type: 'USER',
            content: 'سلام!'
          }
        ]
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('Failed to create session:', sessionResponse.status, errorText);
      throw new Error(`Failed to create session: ${sessionResponse.statusText}`);
    }

    const sessionData = await sessionResponse.json();
    const sessionId = sessionData.id;

    console.log('Session created:', sessionId);
    console.log('Sending user question...');

    // Step 2: Send user question
    const messageResponse = await fetch(`${METIS_BASE_URL}/chat/session/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${METIS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          content: question,
          type: 'USER'
        }
      }),
    });

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Failed to send message:', messageResponse.status, errorText);
      throw new Error(`Failed to send message: ${messageResponse.statusText}`);
    }

    const messageData = await messageResponse.json();

    console.log('Received answer from Metis');

    return new Response(
      JSON.stringify({
        answer: messageData.content,
        timestamp: messageData.timestamp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ask-metis-question:', error);
    return new Response(
      JSON.stringify({ 
        error: 'متأسفانه در حال حاضر نمی‌توانم پاسخ دهم. لطفاً دوباره تلاش کنید.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
