import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireMemberOrAdmin } from '@/lib/auth';

// Configure the API route
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

// --- CORS HEADERS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- OPTIONS handler for preflight ---
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// --- POST handler ---
export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  const dlog = (...args: unknown[]) => {
    if (!isProd) console.log(...args);
  };

  // Check if we're in development mode - allow all requests
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Check if request is coming from Whop platform (iframe context)
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const isWhopRequest = origin.includes('whop.com') || referer.includes('whop.com');
  
  // In production, check authentication for non-Whop requests
  if (!isDev && !isWhopRequest) {
    // Members-only gate (admins bypass) for non-Whop requests
    const gate = await requireMemberOrAdmin();
    
    console.log('🔍 Auth Gate Check (non-Whop):', {
      environment: process.env.NODE_ENV,
      allowed: gate.allowed,
      reason: gate.reason,
      origin,
      referer,
    });
    
    if (!gate.allowed) {
      console.log('❌ Access denied:', gate.reason);
      return NextResponse.json(
        { error: 'Members only', reason: gate.reason },
        { status: 403, headers: corsHeaders }
      );
    }
  } else if (isWhopRequest) {
    console.log('✅ Request from Whop platform - allowing access', { origin, referer });
  } else {
    console.log('⚠️  Development mode: Allowing access');
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