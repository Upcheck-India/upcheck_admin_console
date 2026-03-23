// src/app/api/download/[id]/route.js
// Legacy endpoint - redirects to new /api/resources/[id]/download
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { id } = params;

  // Redirect to the new download endpoint
  return NextResponse.redirect(new URL(`/api/resources/${id}/download`, req.url));
}
