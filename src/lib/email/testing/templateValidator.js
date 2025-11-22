/**
 * Email Template Testing and Validation System
 * Comprehensive testing for email rendering, accessibility, and deliverability
 */

import { JSDOM } from 'jsdom';

/**
 * Email Template Validator
 */
export class EmailTemplateValidator {
  constructor() {
    this.validationRules = {
      html: {
        maxSize: 102400, // 100KB
        maxLineLength: 998, // RFC 5321 limit
        requiredElements: ['html', 'head', 'body'],
        forbiddenElements: ['script', 'object', 'embed', 'form'],
        requiredMetaTags: ['charset', 'viewport']
      },
      css: {
        maxInlineStyles: 50,
        forbiddenProperties: ['position: fixed', 'position: absolute'],
        requiredMediaQueries: ['max-width: 600px']
      },
      accessibility: {
        requiredAttributes: ['alt', 'role'],
        colorContrast: 4.5, // WCAG AA standard
        maxNestingLevel: 6
      },
      deliverability: {
        maxImageRatio: 0.4, // 40% images max
        spamKeywords: ['free', 'urgent', 'act now', 'limited time'],
        maxExclamationMarks: 3
      }
    };
  }

  /**
   * Validate complete email template
   */
  async validateTemplate(htmlContent, options = {}) {
    const {
      checkAccessibility = true,
      checkDeliverability = true,
      checkClientCompatibility = true,
      checkPerformance = true
    } = options;

    const results = {
      valid: true,
      score: 100,
      errors: [],
      warnings: [],
      suggestions: [],
      details: {}
    };

    try {
      // Parse HTML
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;

      // Basic HTML validation
      const htmlValidation = this.validateHTML(htmlContent, document);
      results.details.html = htmlValidation;
      this.mergeResults(results, htmlValidation);

      // CSS validation
      const cssValidation = this.validateCSS(htmlContent, document);
      results.details.css = cssValidation;
      this.mergeResults(results, cssValidation);

      // Accessibility validation
      if (checkAccessibility) {
        const accessibilityValidation = this.validateAccessibility(document);
        results.details.accessibility = accessibilityValidation;
        this.mergeResults(results, accessibilityValidation);
      }

      // Deliverability validation
      if (checkDeliverability) {
        const deliverabilityValidation = this.validateDeliverability(htmlContent, document);
        results.details.deliverability = deliverabilityValidation;
        this.mergeResults(results, deliverabilityValidation);
      }

      // Client compatibility validation
      if (checkClientCompatibility) {
        const compatibilityValidation = this.validateClientCompatibility(htmlContent, document);
        results.details.compatibility = compatibilityValidation;
        this.mergeResults(results, compatibilityValidation);
      }

      // Performance validation
      if (checkPerformance) {
        const performanceValidation = this.validatePerformance(htmlContent, document);
        results.details.performance = performanceValidation;
        this.mergeResults(results, performanceValidation);
      }

      // Calculate final score
      results.score = this.calculateScore(results);
      results.valid = results.errors.length === 0;

    } catch (error) {
      results.valid = false;
      results.score = 0;
      results.errors.push({
        type: 'parsing',
        message: `Failed to parse HTML: ${error.message}`,
        severity: 'critical'
      });
    }

    return results;
  }

  /**
   * Validate HTML structure and content
   */
  validateHTML(htmlContent, document) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check file size
    if (htmlContent.length > this.validationRules.html.maxSize) {
      validation.errors.push({
        type: 'size',
        message: `HTML size (${htmlContent.length} bytes) exceeds recommended limit (${this.validationRules.html.maxSize} bytes)`,
        severity: 'high'
      });
    }

    // Check line length
    const lines = htmlContent.split('\n');
    const longLines = lines.filter(line => line.length > this.validationRules.html.maxLineLength);
    if (longLines.length > 0) {
      validation.warnings.push({
        type: 'formatting',
        message: `${longLines.length} lines exceed recommended length (${this.validationRules.html.maxLineLength} characters)`,
        severity: 'medium'
      });
    }

    // Check required elements
    for (const element of this.validationRules.html.requiredElements) {
      if (!document.querySelector(element)) {
        validation.errors.push({
          type: 'structure',
          message: `Missing required element: ${element}`,
          severity: 'high'
        });
      }
    }

    // Check forbidden elements
    for (const element of this.validationRules.html.forbiddenElements) {
      const found = document.querySelectorAll(element);
      if (found.length > 0) {
        validation.errors.push({
          type: 'security',
          message: `Forbidden element found: ${element} (${found.length} instances)`,
          severity: 'critical'
        });
      }
    }

    // Check meta tags
    const metaTags = document.querySelectorAll('meta');
    const metaAttributes = Array.from(metaTags).map(meta => 
      meta.getAttribute('charset') ? 'charset' : 
      meta.getAttribute('name') === 'viewport' ? 'viewport' : null
    ).filter(Boolean);

    for (const required of this.validationRules.html.requiredMetaTags) {
      if (!metaAttributes.includes(required)) {
        validation.warnings.push({
          type: 'meta',
          message: `Missing recommended meta tag: ${required}`,
          severity: 'medium'
        });
      }
    }

    // Check DOCTYPE
    if (!htmlContent.toLowerCase().includes('<!doctype html>')) {
      validation.warnings.push({
        type: 'doctype',
        message: 'Missing HTML5 DOCTYPE declaration',
        severity: 'low'
      });
    }

    return validation;
  }

  /**
   * Validate CSS styles and compatibility
   */
  validateCSS(htmlContent, document) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check inline styles count
    const elementsWithStyle = document.querySelectorAll('[style]');
    if (elementsWithStyle.length > this.validationRules.css.maxInlineStyles) {
      validation.warnings.push({
        type: 'performance',
        message: `High number of inline styles (${elementsWithStyle.length}). Consider using CSS classes.`,
        severity: 'medium'
      });
    }

    // Check for forbidden CSS properties
    for (const element of elementsWithStyle) {
      const style = element.getAttribute('style');
      for (const forbidden of this.validationRules.css.forbiddenProperties) {
        if (style.includes(forbidden)) {
          validation.warnings.push({
            type: 'compatibility',
            message: `Potentially problematic CSS property: ${forbidden}`,
            severity: 'medium'
          });
        }
      }
    }

    // Check for media queries
    const styleElements = document.querySelectorAll('style');
    let hasResponsiveCSS = false;
    
    for (const styleEl of styleElements) {
      const cssContent = styleEl.textContent;
      for (const mediaQuery of this.validationRules.css.requiredMediaQueries) {
        if (cssContent.includes(mediaQuery)) {
          hasResponsiveCSS = true;
          break;
        }
      }
    }

    if (!hasResponsiveCSS) {
      validation.suggestions.push({
        type: 'responsive',
        message: 'Consider adding responsive CSS for mobile devices',
        severity: 'low'
      });
    }

    // Check for CSS animations
    const animationProperties = ['animation', 'transition', '@keyframes'];
    let hasAnimations = false;
    
    for (const styleEl of styleElements) {
      const cssContent = styleEl.textContent;
      for (const prop of animationProperties) {
        if (cssContent.includes(prop)) {
          hasAnimations = true;
          break;
        }
      }
    }

    if (hasAnimations) {
      validation.suggestions.push({
        type: 'compatibility',
        message: 'CSS animations may not work in all email clients',
        severity: 'low'
      });
    }

    return validation;
  }

  /**
   * Validate accessibility compliance
   */
  validateAccessibility(document) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check images for alt text
    const images = document.querySelectorAll('img');
    for (const img of images) {
      if (!img.getAttribute('alt')) {
        validation.errors.push({
          type: 'accessibility',
          message: `Image missing alt attribute: ${img.getAttribute('src') || 'unknown'}`,
          severity: 'high'
        });
      }
    }

    // Check links for descriptive text
    const links = document.querySelectorAll('a');
    for (const link of links) {
      const text = link.textContent.trim();
      if (!text || text.length < 3) {
        validation.warnings.push({
          type: 'accessibility',
          message: `Link with insufficient descriptive text: "${text}"`,
          severity: 'medium'
        });
      }
      
      // Check for generic link text
      const genericTexts = ['click here', 'read more', 'link', 'here'];
      if (genericTexts.includes(text.toLowerCase())) {
        validation.suggestions.push({
          type: 'accessibility',
          message: `Consider more descriptive link text instead of "${text}"`,
          severity: 'low'
        });
      }
    }

    // Check heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    
    for (const heading of headings) {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > previousLevel + 1) {
        validation.warnings.push({
          type: 'accessibility',
          message: `Heading hierarchy skip detected: ${heading.tagName} after H${previousLevel}`,
          severity: 'medium'
        });
      }
      previousLevel = level;
    }

    // Check for proper table structure
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const headers = table.querySelectorAll('th');
      const hasHeaders = headers.length > 0;
      
      if (!hasHeaders && table.querySelectorAll('td').length > 4) {
        validation.suggestions.push({
          type: 'accessibility',
          message: 'Consider adding table headers for better accessibility',
          severity: 'low'
        });
      }
    }

    // Check color contrast (simplified check)
    const elementsWithColor = document.querySelectorAll('[style*="color"]');
    for (const element of elementsWithColor) {
      const style = element.getAttribute('style');
      // This is a simplified check - in production you'd want proper color contrast calculation
      if (style.includes('color: #fff') && style.includes('background: #fff')) {
        validation.errors.push({
          type: 'accessibility',
          message: 'Potential color contrast issue detected',
          severity: 'high'
        });
      }
    }

    return validation;
  }

  /**
   * Validate deliverability factors
   */
  validateDeliverability(htmlContent, document) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check image to text ratio
    const images = document.querySelectorAll('img');
    const textContent = document.body ? document.body.textContent.trim() : '';
    const imageCount = images.length;
    const textLength = textContent.length;
    
    if (imageCount > 0 && textLength > 0) {
      const imageRatio = imageCount / (imageCount + textLength / 100); // Rough approximation
      if (imageRatio > this.validationRules.deliverability.maxImageRatio) {
        validation.warnings.push({
          type: 'deliverability',
          message: 'High image to text ratio may trigger spam filters',
          severity: 'medium'
        });
      }
    }

    // Check for spam keywords
    const content = htmlContent.toLowerCase();
    const foundSpamKeywords = [];
    
    for (const keyword of this.validationRules.deliverability.spamKeywords) {
      if (content.includes(keyword.toLowerCase())) {
        foundSpamKeywords.push(keyword);
      }
    }
    
    if (foundSpamKeywords.length > 0) {
      validation.warnings.push({
        type: 'deliverability',
        message: `Potential spam keywords found: ${foundSpamKeywords.join(', ')}`,
        severity: 'medium'
      });
    }

    // Check exclamation marks
    const exclamationCount = (htmlContent.match(/!/g) || []).length;
    if (exclamationCount > this.validationRules.deliverability.maxExclamationMarks) {
      validation.warnings.push({
        type: 'deliverability',
        message: `Excessive exclamation marks (${exclamationCount}) may appear spammy`,
        severity: 'low'
      });
    }

    // Check for proper unsubscribe link
    const unsubscribeLinks = Array.from(document.querySelectorAll('a')).filter(link => 
      link.textContent.toLowerCase().includes('unsubscribe') ||
      link.getAttribute('href')?.includes('unsubscribe')
    );
    
    if (unsubscribeLinks.length === 0) {
      validation.suggestions.push({
        type: 'deliverability',
        message: 'Consider adding an unsubscribe link for better deliverability',
        severity: 'low'
      });
    }

    return validation;
  }

  /**
   * Validate email client compatibility
   */
  validateClientCompatibility(htmlContent, document) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      clientSupport: {}
    };

    // Check for Outlook-specific issues
    const outlookIssues = this.checkOutlookCompatibility(htmlContent, document);
    validation.clientSupport.outlook = outlookIssues;
    this.mergeResults(validation, outlookIssues);

    // Check for Gmail-specific issues
    const gmailIssues = this.checkGmailCompatibility(htmlContent, document);
    validation.clientSupport.gmail = gmailIssues;
    this.mergeResults(validation, gmailIssues);

    // Check for Apple Mail issues
    const appleMailIssues = this.checkAppleMailCompatibility(htmlContent, document);
    validation.clientSupport.appleMail = appleMailIssues;
    this.mergeResults(validation, appleMailIssues);

    return validation;
  }

  /**
   * Check Outlook compatibility
   */
  checkOutlookCompatibility(htmlContent, document) {
    const validation = {
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check for CSS properties not supported in Outlook
    const outlookUnsupported = [
      'border-radius',
      'box-shadow',
      'background-size',
      'transform',
      'opacity'
    ];

    const styleElements = document.querySelectorAll('style');
    for (const styleEl of styleElements) {
      const cssContent = styleEl.textContent;
      for (const prop of outlookUnsupported) {
        if (cssContent.includes(prop)) {
          validation.warnings.push({
            type: 'outlook',
            message: `CSS property "${prop}" not fully supported in Outlook`,
            severity: 'medium'
          });
        }
      }
    }

    // Check for VML fallbacks
    if (htmlContent.includes('border-radius') && !htmlContent.includes('<!--[if mso]>')) {
      validation.suggestions.push({
        type: 'outlook',
        message: 'Consider adding VML fallbacks for Outlook compatibility',
        severity: 'low'
      });
    }

    return validation;
  }

  /**
   * Check Gmail compatibility
   */
  checkGmailCompatibility(htmlContent, document) {
    const validation = {
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Gmail strips out <style> tags in some cases
    const hasStyleTag = document.querySelector('style');
    const hasInlineStyles = document.querySelector('[style]');
    
    if (hasStyleTag && !hasInlineStyles) {
      validation.warnings.push({
        type: 'gmail',
        message: 'Gmail may strip <style> tags. Consider using inline styles as fallback.',
        severity: 'medium'
      });
    }

    // Check for Gmail-specific CSS issues
    if (htmlContent.includes('margin') && !htmlContent.includes('padding')) {
      validation.suggestions.push({
        type: 'gmail',
        message: 'Gmail may not respect margins. Consider using padding instead.',
        severity: 'low'
      });
    }

    return validation;
  }

  /**
   * Check Apple Mail compatibility
   */
  checkAppleMailCompatibility(htmlContent, document) {
    const validation = {
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Apple Mail has good CSS support but some quirks
    if (htmlContent.includes('position: fixed')) {
      validation.warnings.push({
        type: 'appleMail',
        message: 'Fixed positioning may not work as expected in Apple Mail',
        severity: 'low'
      });
    }

    return validation;
  }

  /**
   * Validate performance aspects
   */
  validatePerformance(htmlContent, document) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      metrics: {}
    };

    // Calculate load time estimate
    const htmlSize = htmlContent.length;
    const images = document.querySelectorAll('img');
    const estimatedImageSize = images.length * 50000; // Rough estimate: 50KB per image
    const totalSize = htmlSize + estimatedImageSize;
    
    validation.metrics.estimatedSize = totalSize;
    validation.metrics.htmlSize = htmlSize;
    validation.metrics.imageCount = images.length;

    if (totalSize > 1000000) { // 1MB
      validation.warnings.push({
        type: 'performance',
        message: `Large email size (${Math.round(totalSize / 1024)}KB) may cause loading issues`,
        severity: 'medium'
      });
    }

    // Check for external resources
    const externalImages = Array.from(images).filter(img => {
      const src = img.getAttribute('src');
      return src && (src.startsWith('http://') || src.startsWith('https://'));
    });

    validation.metrics.externalImages = externalImages.length;

    if (externalImages.length > 10) {
      validation.warnings.push({
        type: 'performance',
        message: `High number of external images (${externalImages.length}) may slow loading`,
        severity: 'medium'
      });
    }

    return validation;
  }

  /**
   * Merge validation results
   */
  mergeResults(target, source) {
    if (source.errors) target.errors.push(...source.errors);
    if (source.warnings) target.warnings.push(...source.warnings);
    if (source.suggestions) target.suggestions.push(...source.suggestions);
  }

  /**
   * Calculate overall validation score
   */
  calculateScore(results) {
    let score = 100;
    
    // Deduct points for errors
    for (const error of results.errors) {
      switch (error.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }
    
    // Deduct points for warnings
    for (const warning of results.warnings) {
      switch (warning.severity) {
        case 'high':
          score -= 8;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }
    
    return Math.max(0, score);
  }

  /**
   * Generate validation report
   */
  generateReport(validationResults) {
    const report = {
      summary: {
        valid: validationResults.valid,
        score: validationResults.score,
        grade: this.getGrade(validationResults.score),
        totalIssues: validationResults.errors.length + validationResults.warnings.length,
        criticalIssues: validationResults.errors.filter(e => e.severity === 'critical').length
      },
      
      categories: {
        html: this.getCategoryScore(validationResults.details.html),
        css: this.getCategoryScore(validationResults.details.css),
        accessibility: this.getCategoryScore(validationResults.details.accessibility),
        deliverability: this.getCategoryScore(validationResults.details.deliverability),
        compatibility: this.getCategoryScore(validationResults.details.compatibility),
        performance: this.getCategoryScore(validationResults.details.performance)
      },
      
      recommendations: this.generateRecommendations(validationResults),
      
      clientCompatibility: validationResults.details.compatibility?.clientSupport || {},
      
      metrics: validationResults.details.performance?.metrics || {}
    };
    
    return report;
  }

  /**
   * Get grade based on score
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get category-specific score
   */
  getCategoryScore(categoryResults) {
    if (!categoryResults) return 100;
    
    let score = 100;
    
    for (const error of categoryResults.errors || []) {
      switch (error.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    
    for (const warning of categoryResults.warnings || []) {
      switch (warning.severity) {
        case 'high': score -= 10; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
      }
    }
    
    return Math.max(0, score);
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(validationResults) {
    const recommendations = [];
    
    // Priority recommendations based on critical errors
    const criticalErrors = validationResults.errors.filter(e => e.severity === 'critical');
    if (criticalErrors.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Fix Critical Issues',
        description: 'Address critical errors that prevent proper email rendering',
        actions: criticalErrors.map(e => e.message)
      });
    }
    
    // Accessibility recommendations
    const accessibilityIssues = [
      ...validationResults.errors.filter(e => e.type === 'accessibility'),
      ...validationResults.warnings.filter(w => w.type === 'accessibility')
    ];
    
    if (accessibilityIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Improve Accessibility',
        description: 'Make your email accessible to all users including those with disabilities',
        actions: accessibilityIssues.map(i => i.message)
      });
    }
    
    // Deliverability recommendations
    const deliverabilityIssues = validationResults.warnings.filter(w => w.type === 'deliverability');
    if (deliverabilityIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Enhance Deliverability',
        description: 'Improve email deliverability and avoid spam filters',
        actions: deliverabilityIssues.map(i => i.message)
      });
    }
    
    return recommendations;
  }
}

export default EmailTemplateValidator;