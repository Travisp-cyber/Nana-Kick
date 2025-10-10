import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    let parsedBody = {};
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = { raw: rawBody };
    }
    
    // Log everything for debugging
    console.log('=== WEBHOOK DEBUG ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Raw Body:', rawBody);
    console.log('Parsed Body:', JSON.stringify(parsedBody, null, 2));
    console.log('===================');
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      received: {
        headers,
        rawBody,
        parsedBody,
        bodyLength: rawBody.length,
        hasSignature: !!headers['whop-signature'] || !!headers['x-whop-signature']
      }
    });
  } catch (error) {
    console.error('Webhook debug error:', error);
    return NextResponse.json({
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}