import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Read the embed.js file from public folder
    const filePath = path.join(process.cwd(), 'public', 'embed.js');
    const embedScript = fs.readFileSync(filePath, 'utf8');
    
    // Return the file content with proper JavaScript MIME type
    return new NextResponse(embedScript, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving embed.js:', error);
    return NextResponse.json({ error: 'Failed to load embed script' }, { status: 500 });
  }
}