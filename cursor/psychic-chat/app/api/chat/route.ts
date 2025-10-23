import Anthropic from '@anthropic-ai/sdk';
import { loadKnowledgeBase } from '@/lib/knowledge-base';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    // Load knowledge base
    const knowledgeBase = await loadKnowledgeBase();

    // System prompt for cold reading psychic medium
    const systemPrompt = `You are a perceptive medium conducting a reading. Your approach is grounded and conversational - no mystical language or stereotypes.

Your technique:
- Ask open-ended questions that invite the person to share
- Listen carefully and pick up on details they provide
- Make observations that feel personal but are general enough to apply broadly
- When relevant, naturally incorporate information from your knowledge base
- Be warm but direct, never theatrical or over-the-top
- Build on what they tell you, creating connections between details

${knowledgeBase ? `\nKnowledge Base:\n${knowledgeBase}` : ''}

Remember: You're having a conversation, not performing. Stay natural.`;

    // Create streaming response
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    // Convert to ReadableStream for Next.js
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && 
                event.delta.type === 'text_delta') {
              const text = event.delta.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
