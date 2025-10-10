import { NextRequest, NextResponse } from 'next/server'
import { whopSdk } from '@/lib/whop-sdk'

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
    // Use Whop SDK to verify the user token from headers
    let userId: string | undefined
    let isAdmin = false
    
    try {
      // The Whop SDK will extract the user token from request headers automatically
      const { userId: verifiedUserId } = await whopSdk.verifyUserToken(request.headers)
      userId = verifiedUserId
      
      // Check if user is an admin
      const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
      const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID
      isAdmin = Boolean(userId && (adminList.includes(userId) || (agent && userId === agent)))
      
      console.log('🔍 Whop SDK Auth:', {
        userId,
        isAdmin,
        adminList,
        agentId: agent,
      })
      
    } catch (authError) {
      console.log('❌ Whop SDK authentication failed:', authError)
      
      // In development mode, allow access for testing
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️ Development mode: Allowing access despite auth failure')
      } else {
        return NextResponse.json(
          { error: 'Authentication required', details: String(authError) },
          { status: 401, headers: corsHeaders }
        )
      }
    }
    
    // If we have a userId, check if they're authenticated
    if (!userId && process.env.NODE_ENV === 'production') {
      console.log('❌ No user ID found')
      return NextResponse.json(
        { error: 'Members only', reason: 'no_user_id' },
        { status: 403, headers: corsHeaders }
      )
    }
    
    console.log('✅ User authenticated:', { userId, isAdmin })
    
    // Get the form data from the request
    const formData = await request.formData()
    
    // Forward the request to the actual process-image endpoint
    const processImageUrl = `${request.nextUrl.origin}/api/process-image`
    
    console.log('🔄 Proxying request to:', processImageUrl, { userId, isAdmin })
    
    // Create a new request with headers that include the verified user ID
    const forwardHeaders = new Headers(request.headers)
    if (userId) {
      forwardHeaders.set('x-whop-user-id', userId)
      // Mark as admin if applicable
      if (isAdmin) {
        forwardHeaders.set('x-verified-admin', 'true')
      }
    }
    
    const newRequest = new Request(processImageUrl, {
      method: 'POST',
      body: formData,
      headers: forwardHeaders,
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
