import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      return NextResponse.json(
        { error: 'Google AI API key not configured. Please set GOOGLE_AI_API_KEY in .env.local' },
        { status: 500, headers: corsHeaders }
      );
    }

    const formData = await request.formData();
    const image = formData.get('image') as File;
    const instructions = formData.get('instructions') as string;

    if (!image || !instructions) {
      return NextResponse.json(
        { error: 'Missing image or instructions' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Convert image to bytes to check size
    const imageBytes = await image.arrayBuffer();
    const imageSizeBytes = imageBytes.byteLength;
    const imageSizeKB = Math.round(imageSizeBytes / 1024);
    const imageSizeMB = Math.round(imageSizeKB / 1024 * 100) / 100;

    // Log to console as requested
    console.log('=== Image Processing Request ===');
    console.log('User Prompt:', instructions);
    console.log('Image File Name:', image.name);
    console.log('Image Type:', image.type);
    console.log('Image Size (bytes):', imageSizeBytes);
    console.log('Image Size (KB):', imageSizeKB);
    console.log('Image Size (MB):', imageSizeMB);
    console.log('================================');

    // Initialize Google AI with Gemini 2.5 Flash
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-image'
    });
    
    // Convert image to base64
    const imageBase64 = Buffer.from(imageBytes).toString('base64');
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: image.type,
      },
    };

    // Create the edit prompt for image generation/editing
    const editPrompt = `Edit this image according to the following instructions: ${instructions}`;

    console.log('Processing image with Gemini 2.5 Flash (Nano Banana)...');
    
    try {
      // Generate edited image
      const result = await model.generateContent([
        imagePart,
        { text: editPrompt }
      ]);
      
      const response = result.response;
      const candidate = response.candidates?.[0];
      
      if (!candidate) {
        throw new Error('No response candidate from Gemini');
      }

      // Look for image data in the response
      const parts = candidate.content.parts;
      const imageParts = parts.filter((part: { inlineData?: unknown }) => part.inlineData);
      
      if (imageParts.length > 0) {
        // Found edited image
        const editedImageData = imageParts[0].inlineData as { data: string; mimeType?: string };
        const editedImageBase64 = editedImageData.data;
        const editedMimeType = editedImageData.mimeType || image.type;
        
        // Convert base64 to buffer
        const editedImageBuffer = Buffer.from(editedImageBase64, 'base64');
        
        console.log('Image edited successfully!');
        
        // Return the edited image
        return new NextResponse(editedImageBuffer, {
          headers: {
            'Content-Type': editedMimeType,
            'Content-Disposition': 'inline; filename="edited-thumbnail.png"',
            ...corsHeaders
          }
        });
      } else {
        // If no image in response, it might be text-only
        const textResponse = response.text();
        console.log('Gemini response:', textResponse);
        
        return NextResponse.json(
          { 
            error: 'No edited image returned',
            message: 'Gemini 2.5 Flash did not return an edited image. Response: ' + textResponse,
            hint: 'This might mean the model is not configured for image editing in your account or region.'
          },
          { status: 422, headers: corsHeaders }
        );
      }
    } catch (modelError) {
      const errorMessage = modelError instanceof Error ? modelError.message : String(modelError);
      console.error('Model error details:', modelError);
      console.error('Error message:', errorMessage);
      
      // Handle specific model errors
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        return NextResponse.json(
          { 
            error: 'Model not available',
            message: 'Gemini 2.5 Flash (gemini-2.5-flash-image) is not available. This might be because:',
            reasons: [
              '1. The model is in limited preview and not available in your region',
              '2. Your API key doesn\'t have access to this model',
              '3. The model name might be different in the API vs AI Studio'
            ],
            suggestion: 'Try using "gemini-1.5-pro" or check your API access in Google AI Studio',
            fullError: errorMessage
          },
          { status: 404, headers: corsHeaders }
        );
      }
      throw modelError;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500, headers: corsHeaders }
    );
  }
}