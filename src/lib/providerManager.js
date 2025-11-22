/**
 * Provider Management for Recurring Meetings
 * Handles provider selection, fallback logic, and health monitoring
 */

import { checkProviderHealth } from './meetingGenerator.js';
import { validateZoomSettingsForRecurring } from './zoom.js';
import { validateGoogleMeetSettingsForRecurring } from './googleMeet.js';

/**
 * Provider health cache to avoid excessive health checks
 */
const providerHealthCache = new Map();
const HEALTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Provider configuration and capabilities
 */
const PROVIDER_CONFIG = {
  zoom: {
    name: 'Zoom',
    capabilities: {
      uniqueMeetings: true,
      sharedMeetings: false,
      calendarIntegration: false,
      batchCreation: true,
      rateLimiting: true,
      maxBatchSize: 5,
      maxRequestsPerMinute: 100,
    },
    fallbackOptions: ['manual_zoom', 'google_meet'],
    healthCheckInterval: 10 * 60 * 1000, // 10 minutes
  },
  google_meet: {
    name: 'Google Meet',
    capabilities: {
      uniqueMeetings: true,
      sharedMeetings: true,
      calendarIntegration: true,
      batchCreation: true,
      rateLimiting: false,
      maxBatchSize: 10,
      maxRequestsPerMinute: 200,
    },
    fallbackOptions: ['manual_meet', 'zoom'],
    healthCheckInterval: 15 * 60 * 1000, // 15 minutes
  },
};

/**
 * Select the best provider for a recurring series based on requirements and health
 */
export async function selectOptimalProvider(seriesData, options = {}) {
  const { 
    preferredProvider = seriesData.provider,
    requireUniqueMeetings = false,
    requireCalendarIntegration = false,
    checkHealth = true,
  } = options;

  console.log(`Selecting optimal provider for series: ${seriesData.title}`);

  // Start with preferred provider if specified
  if (preferredProvider && PROVIDER_CONFIG[preferredProvider]) {
    const providerConfig = PROVIDER_CONFIG[preferredProvider];
    
    // Check if provider meets requirements
    if (meetsRequirements(providerConfig, { requireUniqueMeetings, requireCalendarIntegration })) {
      
      // Check provider health if requested
      if (checkHealth) {
        const health = await getProviderHealth(preferredProvider);
        if (health.healthy) {
          console.log(`Selected preferred provider: ${preferredProvider}`);
          return {
            provider: preferredProvider,
            config: providerConfig,
            health,
            reason: 'preferred_and_healthy',
          };
        } else {
          console.warn(`Preferred provider ${preferredProvider} is unhealthy:`, health.error);
        }
      } else {
        console.log(`Selected preferred provider without health check: ${preferredProvider}`);
        return {
          provider: preferredProvider,
          config: providerConfig,
          reason: 'preferred_no_health_check',
        };
      }
    } else {
      console.warn(`Preferred provider ${preferredProvider} does not meet requirements`);
    }
  }

  // Find alternative providers that meet requirements
  const availableProviders = Object.entries(PROVIDER_CONFIG)
    .filter(([provider, config]) => 
      meetsRequirements(config, { requireUniqueMeetings, requireCalendarIntegration })
    );

  if (availableProviders.length === 0) {
    throw new Error('No providers available that meet the specified requirements');
  }

  // Check health of available providers and select the best one
  if (checkHealth) {
    for (const [provider, config] of availableProviders) {
      const health = await getProviderHealth(provider);
      if (health.healthy) {
        console.log(`Selected healthy alternative provider: ${provider}`);
        return {
          provider,
          config,
          health,
          reason: 'alternative_healthy',
        };
      }
    }

    // If no healthy providers found, return the first available with warning
    const [fallbackProvider, fallbackConfig] = availableProviders[0];
    console.warn(`No healthy providers found, using fallback: ${fallbackProvider}`);
    
    return {
      provider: fallbackProvider,
      config: fallbackConfig,
      health: { healthy: false, warning: 'No healthy providers available' },
      reason: 'fallback_unhealthy',
    };
  }

  // If health check disabled, return first available provider
  const [selectedProvider, selectedConfig] = availableProviders[0];
  console.log(`Selected provider without health check: ${selectedProvider}`);
  
  return {
    provider: selectedProvider,
    config: selectedConfig,
    reason: 'first_available',
  };
}

/**
 * Get provider health with caching
 */
export async function getProviderHealth(provider, forceRefresh = false) {
  const cacheKey = `health_${provider}`;
  const cached = providerHealthCache.get(cacheKey);
  
  // Return cached result if valid and not forcing refresh
  if (!forceRefresh && cached && (Date.now() - cached.timestamp) < HEALTH_CACHE_TTL) {
    return cached.health;
  }

  try {
    const health = await checkProviderHealth(provider);
    
    // Cache the result
    providerHealthCache.set(cacheKey, {
      health,
      timestamp: Date.now(),
    });

    return health;

  } catch (error) {
    console.error(`Error checking ${provider} health:`, error);
    
    const errorHealth = {
      healthy: false,
      provider,
      error: error.message,
      checkedAt: new Date().toISOString(),
    };

    // Cache error result for shorter time
    providerHealthCache.set(cacheKey, {
      health: errorHealth,
      timestamp: Date.now() - (HEALTH_CACHE_TTL * 0.8), // Expire sooner
    });

    return errorHealth;
  }
}

/**
 * Check if provider meets specified requirements
 */
function meetsRequirements(providerConfig, requirements) {
  const { requireUniqueMeetings, requireCalendarIntegration } = requirements;

  if (requireUniqueMeetings && !providerConfig.capabilities.uniqueMeetings) {
    return false;
  }

  if (requireCalendarIntegration && !providerConfig.capabilities.calendarIntegration) {
    return false;
  }

  return true;
}

/**
 * Get fallback providers for a given provider
 */
export function getFallbackProviders(primaryProvider) {
  const config = PROVIDER_CONFIG[primaryProvider];
  if (!config) {
    return [];
  }

  return config.fallbackOptions
    .map(option => {
      if (option.startsWith('manual_')) {
        return {
          type: 'manual',
          provider: option.replace('manual_', ''),
          name: `Manual ${PROVIDER_CONFIG[option.replace('manual_', '')]?.name || option}`,
        };
      } else if (PROVIDER_CONFIG[option]) {
        return {
          type: 'automatic',
          provider: option,
          name: PROVIDER_CONFIG[option].name,
        };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Validate provider settings for recurring meetings
 */
export function validateProviderSettings(provider, settings) {
  switch (provider) {
    case 'zoom':
      return validateZoomSettingsForRecurring(settings);
    
    case 'google_meet':
      return validateGoogleMeetSettingsForRecurring(settings);
    
    default:
      return {
        isValid: false,
        errors: [`Unknown provider: ${provider}`],
      };
  }
}

/**
 * Get optimal batch configuration for provider
 */
export function getOptimalBatchConfig(provider, totalMeetings) {
  const config = PROVIDER_CONFIG[provider];
  if (!config) {
    return {
      batchSize: 5,
      delayBetweenBatches: 2000,
      maxConcurrent: 3,
    };
  }

  const { capabilities } = config;
  
  // Adjust batch size based on total meetings and provider capabilities
  let batchSize = capabilities.maxBatchSize;
  if (totalMeetings > 100) {
    batchSize = Math.min(batchSize, 3); // Smaller batches for large series
  }

  // Adjust delay based on rate limiting
  let delayBetweenBatches = 2000;
  if (capabilities.rateLimiting) {
    delayBetweenBatches = Math.max(2000, 60000 / capabilities.maxRequestsPerMinute * batchSize);
  }

  // Adjust concurrency
  let maxConcurrent = Math.min(3, batchSize);
  if (capabilities.rateLimiting) {
    maxConcurrent = Math.min(maxConcurrent, 2);
  }

  return {
    batchSize,
    delayBetweenBatches,
    maxConcurrent,
    rateLimited: capabilities.rateLimiting,
  };
}

/**
 * Monitor provider health continuously
 */
export class ProviderHealthMonitor {
  constructor(options = {}) {
    this.options = {
      checkInterval: 5 * 60 * 1000, // 5 minutes
      alertThreshold: 3, // Alert after 3 consecutive failures
      ...options,
    };
    
    this.monitoring = false;
    this.consecutiveFailures = new Map();
    this.healthHistory = new Map();
  }

  start() {
    if (this.monitoring) {
      console.log('Provider health monitoring already started');
      return;
    }

    console.log('Starting provider health monitoring');
    this.monitoring = true;
    this.scheduleNextCheck();
  }

  stop() {
    if (!this.monitoring) {
      return;
    }

    console.log('Stopping provider health monitoring');
    this.monitoring = false;
    
    if (this.checkTimeout) {
      clearTimeout(this.checkTimeout);
    }
  }

  async scheduleNextCheck() {
    if (!this.monitoring) {
      return;
    }

    this.checkTimeout = setTimeout(async () => {
      await this.performHealthChecks();
      this.scheduleNextCheck();
    }, this.options.checkInterval);
  }

  async performHealthChecks() {
    console.log('Performing scheduled provider health checks');

    for (const provider of Object.keys(PROVIDER_CONFIG)) {
      try {
        const health = await getProviderHealth(provider, true); // Force refresh
        
        // Track health history
        const history = this.healthHistory.get(provider) || [];
        history.push({
          timestamp: Date.now(),
          healthy: health.healthy,
          error: health.error,
        });
        
        // Keep only last 24 hours of history
        const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentHistory = history.filter(h => h.timestamp > dayAgo);
        this.healthHistory.set(provider, recentHistory);

        // Track consecutive failures
        if (health.healthy) {
          this.consecutiveFailures.set(provider, 0);
        } else {
          const failures = (this.consecutiveFailures.get(provider) || 0) + 1;
          this.consecutiveFailures.set(provider, failures);

          // Alert if threshold reached
          if (failures >= this.options.alertThreshold) {
            await this.alertProviderIssue(provider, health, failures);
          }
        }

      } catch (error) {
        console.error(`Error in health check for ${provider}:`, error);
      }
    }
  }

  async alertProviderIssue(provider, health, consecutiveFailures) {
    console.warn(`PROVIDER ALERT: ${provider} has failed ${consecutiveFailures} consecutive health checks`);
    
    // This would integrate with the admin notification system
    // For now, we'll log the alert
    const alert = {
      type: 'provider_health_alert',
      provider,
      consecutiveFailures,
      lastError: health.error,
      timestamp: new Date().toISOString(),
      severity: consecutiveFailures >= 5 ? 'critical' : 'warning',
    };

    console.log('Provider health alert:', JSON.stringify(alert, null, 2));
    
    // In a real implementation, this would:
    // 1. Send email/Slack notification to admins
    // 2. Update monitoring dashboard
    // 3. Potentially trigger automatic failover
  }

  getHealthSummary() {
    const summary = {};
    
    for (const provider of Object.keys(PROVIDER_CONFIG)) {
      const failures = this.consecutiveFailures.get(provider) || 0;
      const history = this.healthHistory.get(provider) || [];
      
      // Calculate uptime percentage for last 24 hours
      const healthyChecks = history.filter(h => h.healthy).length;
      const uptimePercentage = history.length > 0 ? (healthyChecks / history.length) * 100 : 0;
      
      summary[provider] = {
        consecutiveFailures: failures,
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
        totalChecks: history.length,
        healthyChecks,
        status: failures === 0 ? 'healthy' : failures < 3 ? 'degraded' : 'unhealthy',
      };
    }
    
    return summary;
  }
}

/**
 * Create and export a singleton health monitor instance
 */
export const healthMonitor = new ProviderHealthMonitor();

/**
 * Initialize provider management system
 */
export function initializeProviderManager(options = {}) {
  console.log('Initializing provider management system');
  
  if (options.enableHealthMonitoring !== false) {
    healthMonitor.start();
  }
  
  // Clear any stale health cache
  providerHealthCache.clear();
  
  console.log('Provider management system initialized');
}

/**
 * Cleanup provider management system
 */
export function cleanupProviderManager() {
  console.log('Cleaning up provider management system');
  
  healthMonitor.stop();
  providerHealthCache.clear();
  
  console.log('Provider management system cleaned up');
}