/**
 * Email Template Versioning and Rollback System
 * Manages template versions and provides rollback capabilities
 */

import { connectToDatabase } from '../../mongodb.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class TemplateVersionManager {
  constructor() {
    this.templatePaths = {
      seriesNotification: 'src/lib/email/templates/seriesNotification.js',
      reminderNotification: 'src/lib/email/templates/reminderNotification.js'
    };
  }

  /**
   * Create a new template version
   */
  async createVersion(templateName, content, metadata = {}) {
    try {
      const { db } = await connectToDatabase();
      
      const version = {
        templateName,
        content,
        contentHash: this.generateContentHash(content),
        version: await this.getNextVersionNumber(templateName),
        metadata: {
          ...metadata,
          createdBy: metadata.createdBy || 'system',
          description: metadata.description || 'Template update',
          changes: metadata.changes || []
        },
        createdAt: new Date(),
        isActive: false,
        testResults: null
      };

      const result = await db.collection('email_template_versions').insertOne(version);
      
      return {
        success: true,
        versionId: result.insertedId,
        version: version.version
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get next version number for template
   */
  async getNextVersionNumber(templateName) {
    try {
      const { db } = await connectToDatabase();
      
      const latestVersion = await db.collection('email_template_versions')
        .findOne(
          { templateName },
          { sort: { version: -1 } }
        );

      return latestVersion ? latestVersion.version + 1 : 1;
    } catch (error) {
      return 1;
    }
  }

  /**
   * Generate content hash for change detection
   */
  generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Activate a specific template version
   */
  async activateVersion(templateName, version) {
    try {
      const { db } = await connectToDatabase();
      
      // Deactivate all versions
      await db.collection('email_template_versions').updateMany(
        { templateName },
        { $set: { isActive: false, deactivatedAt: new Date() } }
      );

      // Activate specified version
      const result = await db.collection('email_template_versions').updateOne(
        { templateName, version },
        { 
          $set: { 
            isActive: true, 
            activatedAt: new Date() 
          } 
        }
      );

      if (result.matchedCount === 0) {
        throw new Error(`Version ${version} not found for template ${templateName}`);
      }

      // Deploy the version to filesystem
      await this.deployVersion(templateName, version);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Deploy version to filesystem
   */
  async deployVersion(templateName, version) {
    try {
      const { db } = await connectToDatabase();
      
      const templateVersion = await db.collection('email_template_versions')
        .findOne({ templateName, version });

      if (!templateVersion) {
        throw new Error(`Template version not found: ${templateName} v${version}`);
      }

      const templatePath = this.templatePaths[templateName];
      if (!templatePath) {
        throw new Error(`Unknown template: ${templateName}`);
      }

      // Create backup of current version
      await this.createBackup(templatePath);

      // Write new version to file
      await fs.writeFile(templatePath, templateVersion.content, 'utf8');

      // Log deployment
      await this.logDeployment(templateName, version);

      return { success: true };
    } catch (error) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  /**
   * Create backup of current template file
   */
  async createBackup(templatePath) {
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${templatePath}.backup.${timestamp}`;
      
      await fs.writeFile(backupPath, content, 'utf8');
      
      return backupPath;
    } catch (error) {
      // If file doesn't exist, that's okay for new templates
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Log deployment activity
   */
  async logDeployment(templateName, version) {
    try {
      const { db } = await connectToDatabase();
      
      await db.collection('template_deployments').insertOne({
        templateName,
        version,
        deployedAt: new Date(),
        deployedBy: 'system'
      });
    } catch (error) {
      console.error('Failed to log deployment:', error);
    }
  }

  /**
   * Rollback to previous version
   */
  async rollbackToPrevious(templateName) {
    try {
      const { db } = await connectToDatabase();
      
      // Get current active version
      const currentVersion = await db.collection('email_template_versions')
        .findOne({ templateName, isActive: true });

      if (!currentVersion) {
        throw new Error('No active version found');
      }

      // Get previous version
      const previousVersion = await db.collection('email_template_versions')
        .findOne(
          { 
            templateName, 
            version: { $lt: currentVersion.version } 
          },
          { sort: { version: -1 } }
        );

      if (!previousVersion) {
        throw new Error('No previous version available for rollback');
      }

      // Activate previous version
      const result = await this.activateVersion(templateName, previousVersion.version);
      
      if (result.success) {
        // Log rollback
        await this.logRollback(templateName, currentVersion.version, previousVersion.version);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Log rollback activity
   */
  async logRollback(templateName, fromVersion, toVersion) {
    try {
      const { db } = await connectToDatabase();
      
      await db.collection('template_rollbacks').insertOne({
        templateName,
        fromVersion,
        toVersion,
        rolledBackAt: new Date(),
        rolledBackBy: 'system'
      });
    } catch (error) {
      console.error('Failed to log rollback:', error);
    }
  }

  /**
   * Get version history for a template
   */
  async getVersionHistory(templateName, limit = 20) {
    try {
      const { db } = await connectToDatabase();
      
      const versions = await db.collection('email_template_versions')
        .find({ templateName })
        .sort({ version: -1 })
        .limit(limit)
        .toArray();

      return {
        success: true,
        versions: versions.map(v => ({
          version: v.version,
          contentHash: v.contentHash,
          isActive: v.isActive,
          createdAt: v.createdAt,
          activatedAt: v.activatedAt,
          metadata: v.metadata,
          testResults: v.testResults ? {
            overallScore: v.testResults.overallScore,
            runAt: v.testResults.runAt
          } : null
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Compare two template versions
   */
  async compareVersions(templateName, version1, version2) {
    try {
      const { db } = await connectToDatabase();
      
      const [v1, v2] = await Promise.all([
        db.collection('email_template_versions').findOne({ templateName, version: version1 }),
        db.collection('email_template_versions').findOne({ templateName, version: version2 })
      ]);

      if (!v1 || !v2) {
        throw new Error('One or both versions not found');
      }

      return {
        success: true,
        comparison: {
          version1: {
            version: v1.version,
            createdAt: v1.createdAt,
            contentHash: v1.contentHash,
            metadata: v1.metadata
          },
          version2: {
            version: v2.version,
            createdAt: v2.createdAt,
            contentHash: v2.contentHash,
            metadata: v2.metadata
          },
          contentChanged: v1.contentHash !== v2.contentHash,
          timeDifference: Math.abs(v2.createdAt - v1.createdAt)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Archive old template versions
   */
  async archiveOldVersions(templateName, keepCount = 10) {
    try {
      const { db } = await connectToDatabase();
      
      // Get versions to archive (keep most recent ones)
      const versionsToArchive = await db.collection('email_template_versions')
        .find({ templateName })
        .sort({ version: -1 })
        .skip(keepCount)
        .toArray();

      if (versionsToArchive.length === 0) {
        return { success: true, archivedCount: 0 };
      }

      // Move to archive collection
      await db.collection('email_template_versions_archive').insertMany(
        versionsToArchive.map(v => ({
          ...v,
          archivedAt: new Date()
        }))
      );

      // Remove from main collection
      const versionIds = versionsToArchive.map(v => v._id);
      await db.collection('email_template_versions').deleteMany({
        _id: { $in: versionIds }
      });

      return {
        success: true,
        archivedCount: versionsToArchive.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current active version content
   */
  async getCurrentVersion(templateName) {
    try {
      const { db } = await connectToDatabase();
      
      const activeVersion = await db.collection('email_template_versions')
        .findOne({ templateName, isActive: true });

      if (!activeVersion) {
        return {
          success: false,
          error: 'No active version found'
        };
      }

      return {
        success: true,
        version: activeVersion
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create version from current filesystem template
   */
  async createVersionFromFile(templateName, metadata = {}) {
    try {
      const templatePath = this.templatePaths[templateName];
      if (!templatePath) {
        throw new Error(`Unknown template: ${templateName}`);
      }

      const content = await fs.readFile(templatePath, 'utf8');
      
      return await this.createVersion(templateName, content, {
        ...metadata,
        source: 'filesystem',
        description: metadata.description || 'Version created from current file'
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate template version before activation
   */
  async validateVersion(templateName, version) {
    try {
      const { db } = await connectToDatabase();
      
      const templateVersion = await db.collection('email_template_versions')
        .findOne({ templateName, version });

      if (!templateVersion) {
        throw new Error('Template version not found');
      }

      // Basic validation checks
      const validation = {
        hasContent: templateVersion.content && templateVersion.content.length > 0,
        hasValidSyntax: this.validateTemplateSyntax(templateVersion.content),
        hasTestResults: templateVersion.testResults !== null,
        testsPassed: templateVersion.testResults?.overallScore >= 70
      };

      const isValid = Object.values(validation).every(check => check === true);

      return {
        success: true,
        isValid,
        validation,
        canActivate: isValid
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Basic template syntax validation
   */
  validateTemplateSyntax(content) {
    try {
      // Check for basic JavaScript syntax
      new Function(content);
      
      // Check for required exports
      return content.includes('export') && 
             (content.includes('renderTemplate') || content.includes('render'));
    } catch (error) {
      return false;
    }
  }
}

export default TemplateVersionManager;