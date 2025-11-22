/**
 * Admin Metrics API
 * Provides system metrics and performance data
 */

import { NextResponse } from 'next/server';
import { metricsCollector } from '../../../../lib/monitoring.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const latest = searchParams.get('latest') === 'true';

    if (latest) {
      // Get latest metrics
      const metrics = metricsCollector.getLatestMetrics();
      
      return NextResponse.json({
        success: true,
        data: metrics
      });
    } else {
      // Get metrics for time range
      const metrics = metricsCollector.getMetrics(startTime, endTime);
      
      return NextResponse.json({
        success: true,
        data: metrics,
        count: metrics.length
      });
    }

  } catch (error) {
    console.error('Error getting metrics:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get metrics',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'collect':
        // Force metrics collection
        const metrics = await metricsCollector.collectMetrics();
        
        return NextResponse.json({
          success: true,
          data: metrics,
          message: 'Metrics collected successfully'
        });

      case 'start':
        // Start metrics collection
        metricsCollector.initialize();
        
        return NextResponse.json({
          success: true,
          message: 'Metrics collection started'
        });

      case 'stop':
        // Stop metrics collection
        metricsCollector.stop();
        
        return NextResponse.json({
          success: true,
          message: 'Metrics collection stopped'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error handling metrics action:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to handle metrics action',
      details: error.message
    }, { status: 500 });
  }
}