import { NextRequest, NextResponse } from 'next/server'
import { consumeGeneration } from '@/lib/usage'

/**
 * POST /api/use-generation
 *
 * Request body:
 *   {
 *     community_id: string,
 *     prompt?: string,
 *     data?: any
 *   }
 *
 * Behavior:
 *  - Enforces community pool limits
 *  - Mocks an image-generation API call (Nano Banana)
 *  - Increments usage and logs a transaction
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      community_id?: string
      prompt?: string
      data?: unknown
    }

    if (!body.community_id) {
      return NextResponse.json({ error: 'community_id is required' }, { status: 400 })
    }

    const result = await consumeGeneration({
      communityId: body.community_id,
      prompt: body.prompt,
      data: body.data,
    })

    if (!result.ok) {
      // 402 is appropriate for payment/limit situations; could also use 429
      const status = result.error.includes('monthly limit') ? 402 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ success: true, remaining: result.remaining, job: result.job })
  } catch (err) {
    console.error('use-generation error', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}