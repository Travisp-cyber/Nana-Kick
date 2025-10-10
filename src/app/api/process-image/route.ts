import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { whopSdk } from '@/lib/whop-sdk';

// Configure the API route
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

// --- CORS HEADERS ---
function getCorsHeaders(origin: string | null) {
  const allowedOrigins = [
    'https://whop.com',
    'https://www.whop.com',
    'https://nana-kick.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  
  // Allow all Whop subdomains (*.whop.com and *.apps.whop.com)
  const isWhopOrigin = origin?.includes('whop.com') || origin?.includes('.apps.whop.com');
  const isAllowed = allowedOrigins.includes(origin || '') || isWhopOrigin;
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || 'https://whop.com') : 'https://whop.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
};
}

// --- OPTIONS handler for preflight ---
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// --- POST handler ---
export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  const dlog = (...args: unknown[]) => {
    if (!isProd) console.log(...args);
  };

  // Get CORS headers based on origin
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Check if we're in development mode - allow all requests
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Check if request is coming from Whop platform (iframe context)
  const referer = request.headers.get('referer') || '';
  const isWhopRequest = origin?.includes('whop.com') || referer.includes('whop.com');
  
  // Check authentication and access rights
  if (!isDev) {
    // Only allow requests from Whop platform
    if (!isWhopRequest) {
      console.log('❌ Request not from Whop platform - authentication required');
      return NextResponse.json(
        { 
          error: 'Access denied', 
          message: 'This app can only be accessed through the Whop platform.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // If request is from Whop, trust that Whop has already authenticated the user
    // Whop only shows apps to users who have purchased access
    console.log('✅ Request from Whop platform - access granted');
    console.log('   Origin:', origin);
    console.log('   Referer:', referer);
    
    // Optional: Try to identify the user for logging purposes (but don't fail if we can't)
    try {
      const { userId } = await whopSdk.verifyUserToken(request.headers);
      const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
      const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
      const isAdmin = adminList.includes(userId) || (agent && userId === agent);
      
      console.log(isAdmin ? '👑 Admin user:' : '👤 User:', userId);
    } catch (e) {
      console.log('ℹ️  Could not identify specific user, but request is from Whop - allowing access');
    }
  } else {
    console.log('⚠️  Development mode: Allowing all access');
  }

  dlog('=== API Route Called ===');
  dlog('Method:', request.method);
  dlog('URL:', request.url);

  try {
    // --- API key check ---
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      console.error('Google AI API key missing');
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY not configured in environment.' },
        { status: 500, headers: corsHeaders }
      );
    }

    // --- Parse form data ---
    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const instructions = formData.get('instructions') as string | null;

    dlog('Form data received:');
    dlog('- Has image:', !!image);
    dlog('- Instructions:', instructions);

    if (!image || !instructions) {
      return NextResponse.json(
        { error: 'Missing image or instructions' },
        { status: 400, headers: corsHeaders }
      );
    }

    // --- Image size check ---
    const imageBytes = await image.arrayBuffer();
    const imageSizeBytes = imageBytes.byteLength;
    const imageSizeMB = (imageSizeBytes / (1024 * 1024)).toFixed(2);
    dlog(`Image size: ${imageSizeMB} MB`);

    // Note: Vercel Hobby plan has a 4.5MB request body limit
    // We set to 4MB to account for base64 encoding overhead
    const maxSizeMB = 4;
    if (Number(imageSizeMB) > maxSizeMB) {
      return NextResponse.json(
        { error: `Image too large (${imageSizeMB}MB). Maximum size is ${maxSizeMB}MB. Please reduce the image size or upgrade to Vercel Pro for larger uploads.` },
        { status: 413, headers: corsHeaders }
      );
    }

    // --- Initialize Gemini 2.5 Flash Image model ---
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
    });

    // --- Convert image to base64 for API input ---
    const imageBase64 = Buffer.from(imageBytes).toString('base64');
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: image.type,
      },
    };

    // --- Edit prompt ---
    const editPrompt = `Edit this image according to the following instructions: ${instructions}`;

    dlog('Processing image with Gemini 2.5 Flash Image...');

    const result = await model.generateContent([imagePart, { text: editPrompt }]);
    const response = result.response;
    const candidate = response.candidates?.[0];

    if (!candidate) throw new Error('No response candidate from Gemini.');

    // --- Extract edited image ---
    const parts = candidate.content.parts;
    const imageParts = parts.filter((p: { inlineData?: unknown }) => p.inlineData);
    if (imageParts.length > 0) {
      const editedImageData = imageParts[0].inlineData as {
        data: string;
        mimeType?: string;
      };
      const editedImageBuffer = Buffer.from(editedImageData.data, 'base64');
      const mimeType = editedImageData.mimeType || image.type;

      dlog('Image edited successfully!');
      return new NextResponse(editedImageBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': 'inline; filename="edited-image.png"',
          ...corsHeaders,
        },
      });
    }

    // --- Fallback if only text returned ---
    const textResponse = response.text();
    dlog('Gemini text response:', textResponse);

    return NextResponse.json(
      {
        error: 'No edited image returned',
        message:
          'Gemini 2.5 Flash Image did not return an image. Response: ' + textResponse,
      },
      { status: 422, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error processing image:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to process request: ${message}` },
      { status: 500, headers: corsHeaders }
    );
  }
}