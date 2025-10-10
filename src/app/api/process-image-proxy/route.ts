import { NextRequest, NextResponse } from 'next/server'
import { requireMemberOrAdmin } from '@/lib/auth'

// Get CORS headers based on origin
function getCorsHeaders(origin: string | null) {
  const allowedOrigins = [
    'https://whop.com',
    'https://www.whop.com',
    'https://nana-kick.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ]
  
  // Allow Whop subdomains
  const isWhopOrigin = origin?.includes('whop.com') || origin?.includes('.apps.whop.com')
  const isAllowed = allowedOrigins.includes(origin || '') || isWhopOrigin
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || 'https://whop.com') : 'https://whop.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization, X-Requested-With, x-whop-user-id, x-whop-user-token, x-whop-authorization',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  return new Response(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
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
      requestHeaders: {
        'x-whop-user-id': request.headers.get('x-whop-user-id'),
        'x-whop-user-token': request.headers.get('x-whop-user-token'),
        'x-whop-authorization': request.headers.get('x-whop-authorization'),
        'authorization': request.headers.get('authorization'),
        'origin': request.headers.get('origin'),
        'referer': request.headers.get('referer'),
      }
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
    
    // Create a new request with all the original headers
    const newRequest = new Request(processImageUrl, {
      method: 'POST',
      body: formData,
      headers: {
        // Copy all headers from the original request
        ...Object.fromEntries(request.headers.entries()),
      }
    })
    
    const response = await fetch(newRequest)
    
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
