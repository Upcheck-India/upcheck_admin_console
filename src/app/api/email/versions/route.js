/**
 * Email Template Versioning API
 * Manages template versions and rollback capabilities
 */

import { NextResponse } from 'next/server';
import TemplateVersionManager from '../../../../lib/email/testing/templateVersioning.js';

const versionManager = new TemplateVersionManager();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateName = searchParams.get('template');
    const limit = parseInt(searchParams.get('limit')) || 20;

    if (!templateName) {
      return NextResponse.json({
        success: false,
        error: 'Template name is required'
      }, { status: 400 });
    }

    const history = await versionManager.getVersionHistory(templateName, limit);

    return NextResponse.json(history);

  } catch (error) {
    console.error('Version history error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve version history'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { templateName, content, metadata } = body;

    if (!templateName || !content) {
      return NextResponse.json({
        success: false,
        error: 'Template name and content are required'
      }, { status: 400 });
    }

    const result = await versionManager.createVersion(templateName, content, metadata);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Version creation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create template version'
    }, { status: 500 });
  }
}