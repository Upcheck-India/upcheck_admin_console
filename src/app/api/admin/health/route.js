/**
 * Admin Health Check API
 * Provides system health status and metrics
 */

import { NextResponse } from 'next/server';
import { getSystemStatus, healthCheckSystem } from '../../../../lib/monitoring.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    if (detailed) {
      // Get comprehensive system status
      const status = await getSystemStatus();
      
      return NextResponse.json({
        success: true,
        data: status
      });
    } else {
      // Get basic health check
      const healthStatus = await healthCheckSystem.runHealthChecks();
      
      return NextResponse.json({
        success: true,
        data: {
          overall: healthStatus.overall,
          timestamp: healthStatus.timestamp,
          summary: {
            healthy: healthStatus.overall.status === 'healthy',
            status: healthStatus.overall.status,
            score: healthStatus.overall.score
          }
        }
      });
    }

  } catch (error) {
    console.error('Error getting health status:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get health status',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { checkName } = await request.json();

    if (checkName) {
      // Run specific health check
      const result = await healthCheckSystem.runSingleCheck(checkName);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    } else {
      // Run all health checks
      const results = await healthCheckSystem.runHealthChecks();
      
      return NextResponse.json({
        success: true,
        data: results
      });
    }

  } catch (error) {
    console.error('Error running health checks:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to run health checks',
      details: error.message
    }, { status: 500 });
  }
}