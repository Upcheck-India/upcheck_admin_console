/**
 * Individual Template Version Management API
 */

import { NextResponse } from 'next/server';
import TemplateVersionManager from '../../../../../lib/email/testing/templateVersioning.js';

const versionManager = new TemplateVersionManager();

export async function GET(request, { params }) {
  try {
    const { templateName } = params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version');

    if (version) {
      // Get specific version
      const result = await versionManager.getCurrentVersion(templateName);
      return NextResponse.json(result);
    } else {
      // Get current active version
      const result = await versionManager.getCurrentVersion(templateName);
      return NextResponse.json(result);
    }

  } catch (error) {
    console.error('Get version error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve template version'
    }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { templateName } = params;
    const body = await request.json();
    const { action, version, ...data } = body;

    let result;

    switch (action) {
      case 'activate':
        if (!version) {
          return NextResponse.json({
            success: false,
            error: 'Version number is required for activation'
          }, { status: 400 });
        }
        result = await versionManager.activateVersion(templateName, version);
        break;

      case 'rollback':
        result = await versionManager.rollbackToPrevious(templateName);
        break;

      case 'validate':
        if (!version) {
          return NextResponse.json({
            success: false,
            error: 'Version number is required for validation'
          }, { status: 400 });
        }
        result = await versionManager.validateVersion(templateName, version);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: activate, rollback, validate'
        }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Version management error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to manage template version'
    }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { templateName } = params;
    const { searchParams } = new URL(request.url);
    const keepCount = parseInt(searchParams.get('keep')) || 10;

    const result = await versionManager.archiveOldVersions(templateName, keepCount);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Version archival error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to archive old versions'
    }, { status: 500 });
  }
}