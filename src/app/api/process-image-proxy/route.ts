import { NextRequest, NextResponse } from 'next/server'
import { requireMemberOrAdmin } from '@/lib/auth'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization, X-Requested-With',
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication first
    const gate = await requireMemberOrAdmin()
    
    console.log('🔍 Proxy Auth Gate Check:', {
      environment: process.env.NODE_ENV,
      allowed: gate.allowed,
      reason: gate.reason,
      userId: gate.session?.userId,
      membershipId: gate.session?.membershipId,
      agentId: process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID,
      adminIds: process.env.ADMIN_WHOP_USER_IDS,
      hasSession: !!gate.session,
      sessionValid: gate.session?.isValid,
    })
    
    // Only allow if user is authenticated (admin or member)
    if (!gate.allowed) {
      console.log('❌ Proxy access denied:', gate.reason)
      return NextResponse.json(
        { error: 'Members only', reason: gate.reason },
        { status: 403, headers: corsHeaders }
      )
    }
    
    // Get the form data from the request
    const formData = await request.formData()
    
    // Forward the request to the actual process-image endpoint
    const processImageUrl = `${request.nextUrl.origin}/api/process-image`
    
    console.log('🔄 Proxying request to:', processImageUrl)
    
    const response = await fetch(processImageUrl, {
      method: 'POST',
      body: formData,
      headers: {
        // Forward the original headers that contain Whop authentication
        'x-whop-user-id': request.headers.get('x-whop-user-id') || '',
        'x-whop-user-token': request.headers.get('x-whop-user-token') || '',
        'x-whop-authorization': request.headers.get('x-whop-authorization') || '',
        'authorization': request.headers.get('authorization') || '',
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Process image API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Image processing failed', details: errorText },
        { status: response.status, headers: corsHeaders }
      )
    }
    
    // Forward the response (including image data)
    const responseData = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    
    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
      }
    })
    
  } catch (error) {
    console.error('❌ Proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
