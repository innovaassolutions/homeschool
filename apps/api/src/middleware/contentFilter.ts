import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { ContentFilterService, ContentFilterResult } from '../services/contentFilter';
import { AgeGroup } from '../services/chatgpt';

// Extend Request interface to include filtering results
declare global {
  namespace Express {
    interface Request {
      contentFilter?: ContentFilterResult;
      ageGroup?: AgeGroup;
    }
  }
}

export interface ContentFilterMiddlewareConfig {
  strictMode?: boolean; // If true, block responses with any violations
  logViolations?: boolean; // Whether to log violations
  includeWarnings?: boolean; // Whether to include warnings in response
}

export class ContentFilterMiddleware {
  private contentFilterService: ContentFilterService;
  private logger: winston.Logger;
  private config: ContentFilterMiddlewareConfig;

  constructor(
    contentFilterService: ContentFilterService,
    logger: winston.Logger,
    config: ContentFilterMiddlewareConfig = {}
  ) {
    this.contentFilterService = contentFilterService;
    this.logger = logger;
    this.config = {
      strictMode: false,
      logViolations: true,
      includeWarnings: true,
      ...config
    };
  }

  /**
   * Middleware to filter incoming user messages
   */
  filterUserInput = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { message } = req.body;
      const ageGroup = req.ageGroup || this.extractAgeGroupFromRequest(req);

      if (!message) {
        return next();
      }

      if (!ageGroup) {
        this.logger.warn('Age group not found for content filtering');
        return next();
      }

      const filterResult = await this.contentFilterService.filterContent(
        message,
        ageGroup,
        {
          subject: req.body.subject,
          learningObjective: req.body.learningObjective
        }
      );

      // Log violations if enabled
      if (this.config.logViolations && filterResult.violations.length > 0) {
        this.logger.warn('Content violations detected in user input', {
          ageGroup,
          violationsCount: filterResult.violations.length,
          violations: filterResult.violations.map(v => ({
            type: v.type,
            severity: v.severity,
            description: v.description
          }))
        });
      }

      // Check if content should be blocked
      if (!filterResult.isAppropriate) {
        const response = {
          error: 'inappropriate_content',
          message: 'Your message contains content that is not appropriate. Please try rephrasing your question.',
          ageGroup,
          violations: this.config.includeWarnings ? filterResult.violations.map(v => ({
            type: v.type,
            severity: v.severity,
            description: v.description
          })) : undefined
        };

        return res.status(400).json(response);
      }

      // Update request with filtered content and attach filter result
      req.body.message = filterResult.filteredContent;
      req.contentFilter = filterResult;

      next();

    } catch (error) {
      this.logger.error('Content filtering middleware error:', error);

      // In case of filtering error, either block (strict mode) or allow (permissive)
      if (this.config.strictMode) {
        return res.status(500).json({
          error: 'content_filtering_error',
          message: 'Unable to process your message due to a content filtering error. Please try again.'
        });
      }

      // Allow request to continue in permissive mode
      next();
    }
  };

  /**
   * Middleware to filter outgoing AI responses
   */
  filterAIResponse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ageGroup = req.ageGroup || this.extractAgeGroupFromRequest(req);

      if (!ageGroup) {
        this.logger.warn('Age group not found for AI response filtering');
        return next();
      }

      // Store original res.json method
      const originalJson = res.json.bind(res);

      // Override res.json to filter the response
      res.json = async (body: any) => {
        try {
          if (body && body.content && typeof body.content === 'string') {
            const filterResult = await this.contentFilterService.filterContent(
              body.content,
              ageGroup,
              {
                subject: req.body?.subject,
                learningObjective: req.body?.learningObjective
              }
            );

            // Log violations if enabled
            if (this.config.logViolations && filterResult.violations.length > 0) {
              this.logger.warn('Content violations detected in AI response', {
                ageGroup,
                violationsCount: filterResult.violations.length,
                violations: filterResult.violations.map(v => ({
                  type: v.type,
                  severity: v.severity,
                  description: v.description
                }))
              });
            }

            // Handle inappropriate content
            if (!filterResult.isAppropriate) {
              const fallbackResponse = this.generateFallbackResponse(ageGroup);

              this.logger.error('AI response blocked due to inappropriate content', {
                ageGroup,
                originalContent: body.content,
                violations: filterResult.violations
              });

              body.content = fallbackResponse;
              body.filtered = true;
              body.ageAppropriate = false;
              body.filterViolations = filterResult.violations;
            } else {
              // Update with filtered content
              body.content = filterResult.filteredContent;
              body.filtered = filterResult.filteredContent !== body.content;
              body.ageAppropriate = true;

              // Add warnings if enabled
              if (this.config.includeWarnings && filterResult.warnings.length > 0) {
                body.filterWarnings = filterResult.warnings;
              }
            }

            // Add filtering metadata
            body.filterConfidence = filterResult.confidence;
          }

          return originalJson(body);

        } catch (error) {
          this.logger.error('Error filtering AI response:', error);

          // In strict mode, replace with fallback response
          if (this.config.strictMode && body && body.content) {
            const fallbackResponse = this.generateFallbackResponse(ageGroup!);
            body.content = fallbackResponse;
            body.filtered = true;
            body.ageAppropriate = false;
            body.filterError = true;
          }

          return originalJson(body);
        }
      };

      next();

    } catch (error) {
      this.logger.error('AI response filtering middleware error:', error);
      next();
    }
  };

  /**
   * Middleware to validate age-appropriate content access
   */
  validateAgeAppropriateAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ageGroup = req.ageGroup || this.extractAgeGroupFromRequest(req);
      const requestedTopic = req.body?.topic || req.query?.topic;
      const requestedSubject = req.body?.subject || req.query?.subject;

      if (!ageGroup) {
        this.logger.warn('Age group not found for age-appropriate access validation');
        return next();
      }

      // Check if the requested topic/subject is age-appropriate
      if (requestedTopic || requestedSubject) {
        const testContent = `${requestedSubject || ''} ${requestedTopic || ''}`.trim();

        if (testContent) {
          const filterResult = await this.contentFilterService.filterContent(
            testContent,
            ageGroup
          );

          if (!filterResult.isAppropriate) {
            const response = {
              error: 'age_inappropriate_topic',
              message: `This topic is not appropriate for your age group. Please ask about something else or talk to a parent or teacher.`,
              ageGroup,
              blockedContent: requestedTopic || requestedSubject
            };

            this.logger.warn('Age-inappropriate topic access blocked', {
              ageGroup,
              requestedTopic,
              requestedSubject,
              violations: filterResult.violations
            });

            return res.status(403).json(response);
          }
        }
      }

      next();

    } catch (error) {
      this.logger.error('Age-appropriate access validation error:', error);
      next();
    }
  };

  /**
   * Extract age group from request (user session, JWT, etc.)
   */
  private extractAgeGroupFromRequest(req: Request): AgeGroup | null {
    // Try to get age group from various sources
    if (req.ageGroup) {
      return req.ageGroup;
    }

    // From authenticated user context (added by auth middleware)
    if (req.user && (req.user as any).ageGroup) {
      return (req.user as any).ageGroup as AgeGroup;
    }

    // From request body
    if (req.body && req.body.ageGroup) {
      return req.body.ageGroup as AgeGroup;
    }

    // From query parameters
    if (req.query && req.query.ageGroup) {
      return req.query.ageGroup as AgeGroup;
    }

    return null;
  }

  /**
   * Generate age-appropriate fallback response
   */
  private generateFallbackResponse(ageGroup: AgeGroup): string {
    switch (ageGroup) {
      case 'ages6to9':
        return "I'm sorry, but I can't give you an answer to that right now. Let's talk about something fun instead! What would you like to learn about today?";

      case 'ages10to13':
        return "I apologize, but I can't provide a response to that question. Let's try a different topic. What subject are you studying that I can help you with?";

      case 'ages14to16':
        return "I'm unable to respond to that request due to content guidelines. Please rephrase your question or ask about a different topic. I'm here to help with your learning goals.";

      default:
        return "I'm sorry, but I can't provide a response to that. Please ask about something else, and I'll be happy to help!";
    }
  }

  /**
   * Get middleware statistics
   */
  public getStats(): {
    config: ContentFilterMiddlewareConfig;
    filteringStats: any;
  } {
    return {
      config: this.config,
      filteringStats: this.contentFilterService.getFilteringStats()
    };
  }
}

// Factory function to create content filter middleware
export function createContentFilterMiddleware(
  contentFilterService: ContentFilterService,
  logger: winston.Logger,
  config?: ContentFilterMiddlewareConfig
): ContentFilterMiddleware {
  return new ContentFilterMiddleware(contentFilterService, logger, config);
}

// Individual middleware functions for easy use
export function createUserInputFilter(middleware: ContentFilterMiddleware) {
  return middleware.filterUserInput;
}

export function createAIResponseFilter(middleware: ContentFilterMiddleware) {
  return middleware.filterAIResponse;
}

export function createAgeAppropriateAccessValidator(middleware: ContentFilterMiddleware) {
  return middleware.validateAgeAppropriateAccess;
}