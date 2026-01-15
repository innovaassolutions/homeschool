import winston from 'winston';
import { ProgressRepository } from './progressRepository';
import { LearningSessionProgress, ProgressAnalytics } from './progressTracking';

/**
 * Cross-Device Progress Synchronization Service
 *
 * Handles secure synchronization of progress data across devices
 * using SurrealDB live queries and real-time updates.
 */
export class ProgressSynchronizationService {
  private logger: winston.Logger;
  private repository: ProgressRepository;
  private syncSubscriptions: Map<string, any> = new Map(); // Device-specific subscriptions
  private lastSyncTimestamps: Map<string, Date> = new Map(); // Per-device sync tracking

  constructor(repository: ProgressRepository, logger: winston.Logger) {
    this.repository = repository;
    this.logger = logger;
    this.logger.info('ProgressSynchronizationService initialized');
  }

  /**
   * Initialize real-time synchronization for a device/child combination
   */
  async initializeDeviceSync(
    deviceId: string,
    childId: string,
    onUpdate: (progress: LearningSessionProgress) => void
  ): Promise<void> {
    try {
      // Set up SurrealDB live query for real-time updates
      // In a full implementation, this would use SurrealDB's LIVE SELECT feature
      const subscriptionKey = `${deviceId}-${childId}`;

      // Mock live query setup - in real implementation would use:
      // const liveQuery = await db.live('SELECT * FROM session_progress WHERE child_id = $child_id', { child_id: childId });

      this.syncSubscriptions.set(subscriptionKey, {
        deviceId,
        childId,
        onUpdate,
        isActive: true,
        startedAt: new Date()
      });

      // Set initial sync timestamp
      this.lastSyncTimestamps.set(subscriptionKey, new Date());

      this.logger.info('Device sync initialized', {
        deviceId,
        childId,
        subscriptionKey
      });

      // Perform initial sync to catch up on any missed data
      await this.performInitialSync(deviceId, childId, onUpdate);

    } catch (error) {
      this.logger.error('Failed to initialize device sync', {
        error: error instanceof Error ? error.message : error,
        deviceId,
        childId
      });
      throw error;
    }
  }

  /**
   * Perform initial sync to get latest data for a device
   */
  private async performInitialSync(
    deviceId: string,
    childId: string,
    onUpdate: (progress: LearningSessionProgress) => void
  ): Promise<void> {
    try {
      // Get recent session progress data
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

      const recentProgress = await this.repository.getSessionProgressByDateRange(
        childId,
        startDate,
        endDate
      );

      // Send updates for each progress record
      for (const progress of recentProgress) {
        onUpdate(progress);
      }

      this.logger.debug('Initial sync completed', {
        deviceId,
        childId,
        recordsSynced: recentProgress.length
      });

    } catch (error) {
      this.logger.error('Failed to perform initial sync', {
        error: error instanceof Error ? error.message : error,
        deviceId,
        childId
      });
    }
  }

  /**
   * Broadcast progress update to all subscribed devices for a child
   */
  async broadcastProgressUpdate(
    progress: LearningSessionProgress,
    excludeDeviceId?: string
  ): Promise<void> {
    try {
      const relevantSubscriptions = Array.from(this.syncSubscriptions.entries())
        .filter(([key, sub]) => {
          const [deviceId] = key.split('-');
          return sub.childId === progress.childId &&
                 sub.isActive &&
                 deviceId !== excludeDeviceId;
        });

      for (const [subscriptionKey, subscription] of relevantSubscriptions) {
        try {
          subscription.onUpdate(progress);

          // Update sync timestamp
          this.lastSyncTimestamps.set(subscriptionKey, new Date());

          this.logger.debug('Progress update broadcasted', {
            subscriptionKey,
            sessionId: progress.sessionId,
            childId: progress.childId
          });

        } catch (updateError) {
          this.logger.warn('Failed to send update to device', {
            subscriptionKey,
            error: updateError instanceof Error ? updateError.message : updateError
          });

          // Mark subscription as potentially problematic
          subscription.errorCount = (subscription.errorCount || 0) + 1;
          if (subscription.errorCount > 5) {
            subscription.isActive = false;
            this.logger.warn('Deactivating problematic sync subscription', {
              subscriptionKey,
              errorCount: subscription.errorCount
            });
          }
        }
      }

    } catch (error) {
      this.logger.error('Failed to broadcast progress update', {
        error: error instanceof Error ? error.message : error,
        sessionId: progress.sessionId,
        childId: progress.childId
      });
    }
  }

  /**
   * Sync progress data for offline device that's coming back online
   */
  async syncOfflineDevice(
    deviceId: string,
    childId: string,
    lastSyncTimestamp: Date
  ): Promise<LearningSessionProgress[]> {
    try {
      // Get all progress updates since last sync
      const updatedProgress = await this.repository.getSessionProgressByDateRange(
        childId,
        lastSyncTimestamp,
        new Date()
      );

      // Update sync timestamp
      const subscriptionKey = `${deviceId}-${childId}`;
      this.lastSyncTimestamps.set(subscriptionKey, new Date());

      this.logger.info('Offline device synced', {
        deviceId,
        childId,
        lastSyncTimestamp: lastSyncTimestamp.toISOString(),
        recordsSynced: updatedProgress.length
      });

      return updatedProgress;

    } catch (error) {
      this.logger.error('Failed to sync offline device', {
        error: error instanceof Error ? error.message : error,
        deviceId,
        childId,
        lastSyncTimestamp: lastSyncTimestamp.toISOString()
      });
      throw error;
    }
  }

  /**
   * Get sync status for a device
   */
  getDeviceSyncStatus(deviceId: string, childId: string): {
    isActive: boolean;
    lastSync: Date | null;
    errorCount: number;
    uptime: number; // milliseconds
  } {
    const subscriptionKey = `${deviceId}-${childId}`;
    const subscription = this.syncSubscriptions.get(subscriptionKey);
    const lastSync = this.lastSyncTimestamps.get(subscriptionKey);

    if (!subscription) {
      return {
        isActive: false,
        lastSync: null,
        errorCount: 0,
        uptime: 0
      };
    }

    const uptime = Date.now() - subscription.startedAt.getTime();

    return {
      isActive: subscription.isActive,
      lastSync: lastSync || null,
      errorCount: subscription.errorCount || 0,
      uptime
    };
  }

  /**
   * Stop synchronization for a device
   */
  async stopDeviceSync(deviceId: string, childId: string): Promise<void> {
    try {
      const subscriptionKey = `${deviceId}-${childId}`;
      const subscription = this.syncSubscriptions.get(subscriptionKey);

      if (subscription) {
        subscription.isActive = false;
        this.syncSubscriptions.delete(subscriptionKey);
        this.lastSyncTimestamps.delete(subscriptionKey);

        this.logger.info('Device sync stopped', {
          deviceId,
          childId,
          uptime: Date.now() - subscription.startedAt.getTime()
        });
      }

    } catch (error) {
      this.logger.error('Failed to stop device sync', {
        error: error instanceof Error ? error.message : error,
        deviceId,
        childId
      });
    }
  }

  /**
   * Handle conflict resolution when multiple devices update the same session
   */
  async resolveProgressConflict(
    sessionId: string,
    deviceUpdates: Array<{
      deviceId: string;
      progress: LearningSessionProgress;
      timestamp: Date;
    }>
  ): Promise<LearningSessionProgress> {
    try {
      // Sort updates by timestamp (latest wins for most fields)
      const sortedUpdates = deviceUpdates.sort((a, b) =>
        b.timestamp.getTime() - a.timestamp.getTime()
      );

      const latestUpdate = sortedUpdates[0].progress;

      // Merge skill mastery updates from all devices (additive)
      const allSkillUpdates = deviceUpdates.flatMap(update =>
        update.progress.skillMasteryUpdates
      );

      // Merge voice interactions (additive)
      const allVoiceInteractions = deviceUpdates.flatMap(update =>
        update.progress.voiceInteractions
      );

      // Merge photo assessments (additive)
      const allPhotoAssessments = deviceUpdates.flatMap(update =>
        update.progress.photoAssessments
      );

      // Create resolved progress with merged data
      const resolvedProgress: LearningSessionProgress = {
        ...latestUpdate,
        skillMasteryUpdates: this.deduplicateSkillUpdates(allSkillUpdates),
        voiceInteractions: this.deduplicateVoiceInteractions(allVoiceInteractions),
        photoAssessments: this.deduplicatePhotoAssessments(allPhotoAssessments),
        updatedAt: new Date()
      };

      // Save resolved state to database
      await this.repository.updateSessionProgress(resolvedProgress);

      // Broadcast resolution to all devices
      await this.broadcastProgressUpdate(resolvedProgress);

      this.logger.info('Progress conflict resolved', {
        sessionId,
        conflictingDevices: deviceUpdates.length,
        resolvedBy: 'latest_wins_with_additive_merge'
      });

      return resolvedProgress;

    } catch (error) {
      this.logger.error('Failed to resolve progress conflict', {
        error: error instanceof Error ? error.message : error,
        sessionId,
        deviceCount: deviceUpdates.length
      });
      throw error;
    }
  }

  /**
   * Get synchronization statistics
   */
  getSyncStatistics(): {
    activeSubscriptions: number;
    totalDevices: number;
    averageUptime: number;
    totalBroadcasts: number;
    errorRate: number;
  } {
    const subscriptions = Array.from(this.syncSubscriptions.values());
    const activeCount = subscriptions.filter(sub => sub.isActive).length;
    const totalErrors = subscriptions.reduce((sum, sub) => sum + (sub.errorCount || 0), 0);
    const totalUpdates = subscriptions.reduce((sum, sub) => sum + (sub.updateCount || 0), 0);

    const avgUptime = subscriptions.length > 0 ?
      subscriptions.reduce((sum, sub) => sum + (Date.now() - sub.startedAt.getTime()), 0) / subscriptions.length :
      0;

    return {
      activeSubscriptions: activeCount,
      totalDevices: subscriptions.length,
      averageUptime: avgUptime,
      totalBroadcasts: totalUpdates,
      errorRate: totalUpdates > 0 ? totalErrors / totalUpdates : 0
    };
  }

  /**
   * Cleanup inactive and old subscriptions
   */
  cleanupOldSubscriptions(maxAgeHours: number = 24): void {
    const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [key, subscription] of this.syncSubscriptions.entries()) {
      if (!subscription.isActive || subscription.startedAt.getTime() < cutoff) {
        this.syncSubscriptions.delete(key);
        this.lastSyncTimestamps.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info('Cleaned up old sync subscriptions', {
        cleanedCount: cleaned,
        maxAgeHours
      });
    }
  }

  /**
   * Private helper methods
   */

  private deduplicateSkillUpdates(updates: any[]): any[] {
    const skillMap = new Map();
    updates.forEach(update => {
      const key = `${update.skillId}-${update.timestamp.getTime()}`;
      skillMap.set(key, update);
    });
    return Array.from(skillMap.values());
  }

  private deduplicateVoiceInteractions(interactions: any[]): any[] {
    const interactionMap = new Map();
    interactions.forEach(interaction => {
      const key = `${interaction.sessionId}-${interaction.interactionCount}`;
      if (!interactionMap.has(key)) {
        interactionMap.set(key, interaction);
      }
    });
    return Array.from(interactionMap.values());
  }

  private deduplicatePhotoAssessments(assessments: any[]): any[] {
    const assessmentMap = new Map();
    assessments.forEach(assessment => {
      assessmentMap.set(assessment.assessmentId, assessment);
    });
    return Array.from(assessmentMap.values());
  }
}

/**
 * Factory function to create ProgressSynchronizationService
 */
export function createProgressSynchronizationService(
  repository: ProgressRepository,
  logger: winston.Logger
): ProgressSynchronizationService {
  return new ProgressSynchronizationService(repository, logger);
}