import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { whopSdk } from '@/lib/whop-sdk';
import { getUserTierAndUsage, incrementUsage } from '@/lib/whop-usage';
import { prisma } from '@/lib/prisma';

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
      // Check both lowercase and uppercase headers (for Safari compatibility)
      const xWhopUserId = request.headers.get('x-whop-user-id') || request.headers.get('X-Whop-User-Id');
      const xWhopUserToken = request.headers.get('x-whop-user-token');
      
      // Debug: Log all headers to see what's available in iframe context
      console.log('🔍 Available headers in iframe context:', {
        'x-whop-user-id': xWhopUserId,
        'X-Whop-User-Id': request.headers.get('X-Whop-User-Id'),
        'x-whop-user-token': xWhopUserToken,
        'x-whop-authorization': request.headers.get('x-whop-authorization'),
        'authorization': request.headers.get('authorization'),
        'cookie': request.headers.get('cookie'),
        'referer': request.headers.get('referer'),
        'origin': request.headers.get('origin'),
        'user-agent': request.headers.get('user-agent'),
      });
      
      if (xWhopUserToken) {
        // JWT token is available, try to decode it to get user ID
        try {
          // First try SDK verification
          const result = await whopSdk.verifyUserToken(request.headers);
          whopUserId = result.userId;
          console.log('✅ Verified user from SDK:', whopUserId);
        } catch (err) {
          console.error('SDK verification failed, decoding JWT manually:', err);
          
          // Fallback: manually decode JWT to extract user ID
          try {
            // JWT format: header.payload.signature
            const parts = xWhopUserToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
              whopUserId = payload.sub; // 'sub' field contains the user ID
              console.log('✅ Extracted user ID from JWT:', whopUserId);
            } else {
              throw new Error('Invalid JWT format');
            }
          } catch (jwtErr) {
            console.error('Failed to decode JWT:', jwtErr);
            throw new Error('User authentication required');
          }
        }
      } else if (xWhopUserId) {
        // Direct user ID available (from frontend SDK, useful for Safari)
        whopUserId = xWhopUserId;
        console.log('✅ Using direct user ID from frontend SDK:', whopUserId);
      } else {
        // Headers not available - cannot verify user
        console.log('❌ No Whop headers found, cannot verify user');
        console.log('💡 This usually means cookies are blocked (Safari) and the frontend SDK is not sending the user ID');
        throw new Error('User authentication required');
      }
      
      // Check if admin or handle usage limits
      const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
      const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
      const isAdmin = whopUserId ? (adminList.includes(whopUserId) || (agent && whopUserId === agent)) : false;
      
      if (isAdmin) {
        console.log('👑 Admin user - unlimited access:', whopUserId);
      } else {
        // Check tier and usage for non-admin users
        if (!whopUserId) {
          throw new Error('User authentication required');
        }
        const { hasAccess, tier, usage } = await getUserTierAndUsage(whopUserId);
        
        if (!hasAccess) {
          console.log('❌ User has no access pass:', whopUserId);
          
          // Check if free trial was exhausted
          const user = await prisma.user.findUnique({
            where: { whopUserId },
            select: { freeTrialUsed: true }
          });
          
          if (user && user.freeTrialUsed === 0) {
            console.log('🚫 Free trial exhausted for user:', whopUserId);
            return NextResponse.json(
              { 
                error: 'Free trial exhausted',
                message: 'You used all of your free credits. To keep editing, upgrade to one of our plans.',
                isPremiumFeature: true,
                redirectTo: '/plans',
                showUpgradePrompt: true
              },
              { status: 403, headers: corsHeaders }
            );
          }
          
          // No subscription and no free trial
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
  
        // Check if user is at or over their limit - warn about overage charges
        if (usage && usage.used >= usage.limit) {
          const overageCost = (usage.overageCentsPerGen || 10) / 100;
          console.log(`⚠️ User in overage: ${whopUserId}, will charge $${overageCost.toFixed(2)} per generation`);
          console.log(`   Current overage: ${usage.overageUsed || 0} extra gens, $${(usage.overageCharges || 0).toFixed(2)} total`);
          // Continue processing - overage will be charged automatically
        } else if (usage) {
          console.log(`✅ User verified - ${tier} tier (${usage.remaining} remaining):`, whopUserId);
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
    dlog('Image size:', imageBytes.byteLength, 'bytes');
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
          error: 'AI processing timeout', 
          message: 'The AI took too long to process your image. Please try again with a simpler edit or smaller image.',
          isTemporaryError: true,
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
        { 
          error: 'AI model error', 
          message: 'The AI model did not return a valid response. Please try again with a different edit.',
          isTemporaryError: true
        },
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

      // Increment usage after successful image edit
      if (!isDev && whopUserId) {
        await incrementUsage(whopUserId);
        console.log('📊 Usage incremented for user:', whopUserId);
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
      { 
        error: 'Server error', 
        message: `Unable to process your request: ${message}`,
        isTemporaryError: true
      },
      { status: 500, headers: corsHeaders }
    );
  }
}