import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    if (Number(imageSizeMB) > 50) {
      return NextResponse.json(
        { error: 'Image too large (max 50MB)' },
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