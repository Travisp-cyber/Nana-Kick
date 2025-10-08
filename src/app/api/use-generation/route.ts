import { NextRequest, NextResponse } from 'next/server'
import { consumeGeneration } from '@/lib/usage'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/use-generation
 *
 * Request body:
 *   {
 *     member_id: string,
 *     prompt?: string,
 *     data?: any
 *   }
 *
 * Behavior:
 *  - Enforces member pool limits
 *  - Mocks an image-generation API call (Nano Banana)
 *  - Increments usage and logs a transaction
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      member_id?: string
      prompt?: string
      data?: unknown
    }

    if (!body.member_id) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
    }

    const result = await consumeGeneration({
      memberId: body.member_id,
      prompt: body.prompt,
      data: body.data,
    })

    if (!result.ok) {
      // 402 is appropriate for payment/limit situations; could also use 429
      const status = result.error.includes('monthly limit') ? 402 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    // Insert image record if we received an output URL from Nano Banana
    const outputUrl = result.job?.outputUrl
    if (outputUrl) {
      const { error: imgErr } = await supabaseAdmin
        .from('images')
        .insert({
          member_id: body.member_id,
          url: outputUrl,
          prompt: body.prompt ?? null,
        })

      if (imgErr) {
        console.error('Failed to insert image record:', imgErr)
        return NextResponse.json({ success: true, remaining: result.remaining, url: outputUrl, warning: 'Image recorded failed' })
      }

      return NextResponse.json({ success: true, remaining: result.remaining, url: outputUrl })
    }

    // Fallback: no URL available, return job info only
    return NextResponse.json({ success: true, remaining: result.remaining, job: result.job })
  } catch (err) {
    console.error('use-generation error', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}