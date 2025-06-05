import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Read the embed.js file from the public folder
    const filePath = path.join(process.cwd(), 'public', 'embed.js');
    const embedScript = fs.readFileSync(filePath, 'utf8');

    // Return the file content with proper JavaScript MIME type
    return new Response(embedScript, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving embed.js:', error);
    return new Response(JSON.stringify({ error: 'Failed to load embed script' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}