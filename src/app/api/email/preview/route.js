import { NextResponse } from 'next/server';

// Email preview temporarily disabled
export async function GET(request) {
  return NextResponse.json({ error: 'Email preview temporarily disabled' }, { status: 503 });
}

export async function POST(request) {
  return NextResponse.json({ error: 'Email preview temporarily disabled' }, { status: 503 });
}
