import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const instructions = formData.get('instructions') as string;

    if (!image || !instructions) {
      return NextResponse.json(
        { error: 'Missing image or instructions' },
        { status: 400 }
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

    // For now, just return success with some info
    return NextResponse.json({
      success: true,
      message: 'Image and instructions received successfully',
      imageInfo: {
        name: image.name,
        type: image.type,
        sizeBytes: imageSizeBytes,
        sizeKB: imageSizeKB,
        sizeMB: imageSizeMB,
      },
      instructions: instructions,
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}