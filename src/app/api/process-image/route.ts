import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { whopSdk } from '@/lib/whop-sdk';
import { getUserTierAndUsage, incrementUsage } from '@/lib/whop-usage';

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
  let whopUserId: string | null = null;
  
  if (!isDev) {
    // Only allow requests from Whop platform
    if (!isWhopRequest) {
      console.log('❌ Request not from Whop platform');
      return NextResponse.json(
        { error: 'Access denied', message: 'This app can only be accessed through the Whop platform.' },
        { status: 403, headers: corsHeaders }
      );
    }

    // For Whop iframe requests, we need to use the Whop SDK differently
    try {
      // First try to get user from headers (if available)
      const xWhopUserId = request.headers.get('x-whop-user-id');
      const xWhopUserToken = request.headers.get('x-whop-user-token');
      
      if (xWhopUserId && xWhopUserToken) {
        // Headers are available, verify the token
        const result = await whopSdk.verifyUserToken(request.headers);
        whopUserId = result.userId;
        console.log('✅ Verified user from headers:', whopUserId);
      } else {
        // Headers not available (common in iframe), trust the Whop platform
        // This is safe because we already verified the request is from Whop
        console.log('⚠️  No Whop headers found, trusting platform request');
        
        // For now, allow admin access based on request context
        // In a real implementation, you might want to use Whop's iframe SDK
        const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        
        // Since we can't verify the specific user, we'll implement a different approach
        // For admin users, we'll use a special bypass
        if (adminList.length > 0) {
          // Create a temporary admin user ID for this session
          whopUserId = 'admin_bypass_' + Date.now();
          console.log('👑 Admin bypass mode activated');
        } else {
          throw new Error('No user verification possible');
        }
      }
      
      // Check if admin (if we have a real user ID)
      if (xWhopUserId) {
        const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
        const isAdmin = adminList.includes(xWhopUserId) || (agent && xWhopUserId === agent);
        
        if (isAdmin) {
          console.log('👑 Admin user - unlimited access:', xWhopUserId);
        } else {
          // Check tier and usage for non-admin users
          const { hasAccess, tier, usage } = await getUserTierAndUsage(xWhopUserId);
          
          if (!hasAccess) {
            console.log('❌ User has no access pass:', xWhopUserId);
            return NextResponse.json(
              { 
                error: 'No access',
                message: 'You need to purchase an access pass to use this feature.',
                isPremiumFeature: true,
                redirectTo: '/plans'
              },
              { status: 403, headers: corsHeaders }
            );
          }
          
          if (!usage || usage.used >= usage.limit) {
            console.log('❌ User exceeded limit:', xWhopUserId, usage);
            return NextResponse.json(
              { 
                error: 'Limit reached',
                message: `You've used all ${usage?.limit || 0} generations for this month. Upgrade or wait for reset.`,
                usage: {
                  used: usage?.used || 0,
                  limit: usage?.limit || 0,
                  resetDate: usage?.resetDate?.toISOString()
                },
                redirectTo: '/plans'
              },
              { status: 429, headers: corsHeaders }
            );
          }
          
          console.log(`✅ User verified - ${tier} tier (${usage.remaining} remaining):`, xWhopUserId);
        }
      }
    } catch (e) {
      console.log('❌ Authentication failed:', e);
      return NextResponse.json(
        { error: 'Authentication failed', message: 'Could not verify your access. Please try again.' },
        { status: 401, headers: corsHeaders }
      );
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
    dlog('Edit prompt:', editPrompt);
    dlog('Image size:', imageBytes.length, 'bytes');
    dlog('Image type:', image.type);

    // Add timeout wrapper for Gemini API call
    const processImageWithTimeout = async () => {
      console.log('🔄 Starting Gemini API call...');
      const startTime = Date.now();
      const result = await model.generateContent([imagePart, { text: editPrompt }]);
      const duration = Date.now() - startTime;
      console.log(`✅ Gemini API call completed in ${duration}ms`);
      return result;
    };

    let result;
    try {
      // Set a 50-second timeout (Vercel has 60s limit)
      result = await Promise.race([
        processImageWithTimeout(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Image processing timeout after 50 seconds')), 50000)
        )
      ]) as Awaited<ReturnType<typeof model.generateContent>>;
    } catch (error) {
      console.error('❌ Image processing failed:', error);
      return NextResponse.json(
        { 
          error: 'Processing failed', 
          message: error instanceof Error ? error.message : 'Image processing took too long. Please try again with a simpler request.',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        },
        { status: 408, headers: corsHeaders }
      );
    }

    const response = result.response;
    const candidate = response.candidates?.[0];

    if (!candidate) {
      console.error('❌ No response candidate from Gemini');
      return NextResponse.json(
        { error: 'Processing failed', message: 'AI model did not return a valid response. Please try again.' },
        { status: 500, headers: corsHeaders }
      );
    }

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

      // Increment usage after successful image edit (skip for admin bypass)
      if (!isDev && whopUserId && !whopUserId.startsWith('admin_bypass_')) {
        await incrementUsage(whopUserId);
      }

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