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

// Helper to save shared agents
function saveSharedAgents(agents: SharedAgent[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SHARED_AGENTS_FILE, JSON.stringify(agents, null, 2));
  } catch (error) {
    console.error('Error saving shared agents:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }
    
    // Load existing shared agents
    const sharedAgents = loadSharedAgents();
    
    // Remove the agent with the matching API key
    const filteredAgents = sharedAgents.filter(agent => agent.apiKey !== apiKey);
    
    // Check if any agent was removed
    if (filteredAgents.length === sharedAgents.length) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }
    
    // Save the updated list back to the file
    saveSharedAgents(filteredAgents);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}