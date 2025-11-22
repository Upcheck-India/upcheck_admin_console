/**
 * Email Template Preview API
 * Provides live preview capabilities for email templates
 */

import { NextResponse } from 'next/server';
import EmailTemplateTester from '../../../../../lib/email/testing/templateTester.js';
import TemplateVersionManager from '../../../../../lib/email/testing/templateVersioning.js';

const tester = new EmailTemplateTester();
const versionManager = new TemplateVersionManager();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get('type') || 'series';
    const version = searchParams.get('version');
    const variant = searchParams.get('variant') || 'default';

    let previewData;

    if (version) {
      // Preview specific version
      const versionResult = await versionManager.getCurrentVersion(templateType);
      if (!versionResult.success) {
        return NextResponse.json({
          success: false,
          error: 'Template version not found'
        }, { status: 404 });
      }
      
      // Use version content for preview
      previewData = await tester.renderTestTemplate(templateType, variant);
    } else {
      // Preview current template
      previewData = await tester.renderTestTemplate(templateType, variant);
    }

    if (!previewData.success) {
      return NextResponse.json({
        success: false,
        error: previewData.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      preview: {
        html: previewData.html,
        text: previewData.text,
        subject: previewData.subject,
        testData: previewData.testData,
        renderedAt: previewData.renderedAt,
        templateType,
        variant
      }
    });

  } catch (error) {
    console.error('Template preview error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate template preview'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { templateType, customData, variant = 'default' } = body;

    if (!templateType) {
      return NextResponse.json({
        success: false,
        error: 'Template type is required'
      }, { status: 400 });
    }

    // Generate preview with custom data if provided
    let previewData;
    if (customData) {
      // Temporarily override test data generation
      const originalMethod = tester.generateTestData;
      tester.generateTestData = () => customData;
      
      previewData = await tester.renderTestTemplate(templateType, variant);
      
      // Restore original method
      tester.generateTestData = originalMethod;
    } else {
      previewData = await tester.renderTestTemplate(templateType, variant);
    }

    if (!previewData.success) {
      return NextResponse.json({
        success: false,
        error: previewData.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      preview: {
        html: previewData.html,
        text: previewData.text,
        subject: previewData.subject,
        testData: previewData.testData,
        renderedAt: previewData.renderedAt,
        templateType,
        variant
      }
    });

  } catch (error) {
    console.error('Custom template preview error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate custom template preview'
    }, { status: 500 });
  }
}