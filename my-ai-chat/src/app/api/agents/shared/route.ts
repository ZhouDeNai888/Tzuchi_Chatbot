import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Interface for our stored shared agents
interface SharedAgent {
  id: string;
  apiKey: string;
  agentId: string;
  name: string;
  description: string;
  allowedOrigins: string[];
  usageLimit: number | null;
  usageCount: number;
  createdAt: string;
  expiresAt: string | null;
}

// Path to shared agents file
const DATA_DIR = path.join(process.cwd(), 'data');
const SHARED_AGENTS_FILE = path.join(DATA_DIR, 'shared-agents.json');

// Helper to load shared agents
function loadSharedAgents(): SharedAgent[] {
  try {
    if (!fs.existsSync(SHARED_AGENTS_FILE)) {
      return [];
    }
    
    const data = fs.readFileSync(SHARED_AGENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading shared agents:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    // Load the shared agents from the file system
    const sharedAgents = loadSharedAgents();
    
    // Return the list of shared agents
    return NextResponse.json({ sharedAgents });
  } catch (error) {
    console.error('Error fetching shared agents:', error);
    return NextResponse.json({ error: 'Failed to fetch shared agents' }, { status: 500 });
  }
}