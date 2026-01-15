import Surreal from 'surrealdb.js';
import { useProgressStore, CurriculumProgressData, WeeklyProgressData, MonthlyProgressData } from '../stores/progressStore';

class RealTimeProgressService {
  private db: Surreal | null = null;
  private isInitialized = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // 1 second

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.db = new Surreal('ws://localhost:8000/rpc');

      await this.db.signin({
        user: 'root',
        pass: 'root',
      });

      await this.db.use('homeschool', 'progress');

      this.isInitialized = true;
      useProgressStore.getState().setConnectionStatus(true);
      useProgressStore.getState().setError(null);
      this.reconnectAttempts = 0;

      console.log('SurrealDB connection established for progress tracking');
    } catch (error) {
      console.error('Failed to initialize SurrealDB connection:', error);
      useProgressStore.getState().setConnectionStatus(false);
      useProgressStore.getState().setError('Failed to connect to database');

      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    setTimeout(() => {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.initialize();
    }, delay);
  }

  async subscribeToCurrentProgress(childId: string): Promise<() => void> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
      if (!this.db) throw new Error('Database connection not available');
    }

    try {
      // Live query for current progress data
      const currentProgressQuery = `LIVE SELECT * FROM progress WHERE child_id = $childId`;

      const unsubscribeCurrent = await this.db.live(currentProgressQuery, { childId }, (action, result) => {
        if (action === 'CREATE' || action === 'UPDATE') {
          const progressData = this.transformCurrentProgressData(result);
          if (progressData) {
            useProgressStore.getState().setCurrentProgress(childId, progressData);
            useProgressStore.getState().updateLastSync();
          }
        }
      });

      // Live query for learning objectives
      const objectivesQuery = `LIVE SELECT * FROM learning_objectives WHERE child_id = $childId AND completed = true ORDER BY completed_at DESC LIMIT 10`;

      const unsubscribeObjectives = await this.db.live(objectivesQuery, { childId }, (action, result) => {
        if (action === 'CREATE' || action === 'UPDATE') {
          // Refresh current progress to include updated objectives
          this.fetchCurrentProgress(childId);
        }
      });

      // Return combined unsubscribe function
      const combinedUnsubscribe = () => {
        if (typeof unsubscribeCurrent === 'function') unsubscribeCurrent();
        if (typeof unsubscribeObjectives === 'function') unsubscribeObjectives();
      };

      useProgressStore.getState().addSubscription(childId, combinedUnsubscribe);

      return combinedUnsubscribe;
    } catch (error) {
      console.error('Failed to subscribe to progress updates:', error);
      useProgressStore.getState().setError('Failed to subscribe to real-time updates');
      throw error;
    }
  }

  async subscribeToHistoricalProgress(childId: string): Promise<() => void> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
      if (!this.db) throw new Error('Database connection not available');
    }

    try {
      // Live query for weekly progress
      const weeklyQuery = `LIVE SELECT * FROM weekly_progress WHERE child_id = $childId ORDER BY week_start DESC LIMIT 12`;

      const unsubscribeWeekly = await this.db.live(weeklyQuery, { childId }, (action, result) => {
        if (action === 'CREATE' || action === 'UPDATE') {
          this.fetchWeeklyProgress(childId);
        }
      });

      // Live query for monthly progress
      const monthlyQuery = `LIVE SELECT * FROM monthly_progress WHERE child_id = $childId ORDER BY month_start DESC LIMIT 6`;

      const unsubscribeMonthly = await this.db.live(monthlyQuery, { childId }, (action, result) => {
        if (action === 'CREATE' || action === 'UPDATE') {
          this.fetchMonthlyProgress(childId);
        }
      });

      // Return combined unsubscribe function
      return () => {
        if (typeof unsubscribeWeekly === 'function') unsubscribeWeekly();
        if (typeof unsubscribeMonthly === 'function') unsubscribeMonthly();
      };
    } catch (error) {
      console.error('Failed to subscribe to historical progress:', error);
      throw error;
    }
  }

  async fetchCurrentProgress(childId: string): Promise<CurriculumProgressData | null> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
      if (!this.db) return null;
    }

    try {
      useProgressStore.getState().setLoading(true);

      // Fetch current progress
      const progressResult = await this.db.query(`
        SELECT * FROM progress WHERE child_id = $childId
      `, { childId });

      // Fetch recent objectives
      const objectivesResult = await this.db.query(`
        SELECT * FROM learning_objectives
        WHERE child_id = $childId AND completed = true
        ORDER BY completed_at DESC
        LIMIT 10
      `, { childId });

      // Fetch subject progress
      const subjectsResult = await this.db.query(`
        SELECT
          subject,
          count() AS total_objectives,
          count(completed = true) AS completed_objectives,
          math::round((count(completed = true) / count()) * 100) / 100 AS completion_rate,
          math::round(math::mean(success_rate) * 100) / 100 AS average_success_rate
        FROM learning_objectives
        WHERE child_id = $childId
        GROUP BY subject
      `, { childId });

      const progressData = this.transformCurrentProgressData({
        progress: progressResult[0]?.result?.[0],
        objectives: objectivesResult[0]?.result || [],
        subjects: subjectsResult[0]?.result || []
      });

      if (progressData) {
        useProgressStore.getState().setCurrentProgress(childId, progressData);
        useProgressStore.getState().updateLastSync();
      }

      return progressData;
    } catch (error) {
      console.error('Failed to fetch current progress:', error);
      useProgressStore.getState().setError('Failed to fetch progress data');
      return null;
    } finally {
      useProgressStore.getState().setLoading(false);
    }
  }

  async fetchWeeklyProgress(childId: string): Promise<WeeklyProgressData[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
      if (!this.db) return [];
    }

    try {
      const result = await this.db.query(`
        SELECT * FROM weekly_progress
        WHERE child_id = $childId
        ORDER BY week_start DESC
        LIMIT 12
      `, { childId });

      const weeklyData = this.transformWeeklyProgressData(result[0]?.result || []);
      useProgressStore.getState().setWeeklyProgress(childId, weeklyData);

      return weeklyData;
    } catch (error) {
      console.error('Failed to fetch weekly progress:', error);
      return [];
    }
  }

  async fetchMonthlyProgress(childId: string): Promise<MonthlyProgressData[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
      if (!this.db) return [];
    }

    try {
      const result = await this.db.query(`
        SELECT * FROM monthly_progress
        WHERE child_id = $childId
        ORDER BY month_start DESC
        LIMIT 6
      `, { childId });

      const monthlyData = this.transformMonthlyProgressData(result[0]?.result || []);
      useProgressStore.getState().setMonthlyProgress(childId, monthlyData);

      return monthlyData;
    } catch (error) {
      console.error('Failed to fetch monthly progress:', error);
      return [];
    }
  }

  private transformCurrentProgressData(data: any): CurriculumProgressData | null {
    if (!data) return null;

    try {
      const subjectColors = {
        Mathematics: '#10B981',
        Reading: '#3B82F6',
        Science: '#8B5CF6',
        'Social Studies': '#F59E0B'
      };

      const subjectIcons = {
        Mathematics: '🔢',
        Reading: '📚',
        Science: '🔬',
        'Social Studies': '🌍'
      };

      // Transform subject progress
      const subjectProgress = (data.subjects || []).map((subject: any) => ({
        subject: subject.subject,
        totalObjectives: subject.total_objectives || 0,
        completedObjectives: subject.completed_objectives || 0,
        completionRate: subject.completion_rate || 0,
        averageSuccessRate: subject.average_success_rate || 0,
        color: subjectColors[subject.subject] || '#6B7280',
        icon: subjectIcons[subject.subject] || '📖'
      }));

      // Transform learning objectives
      const recentObjectives = (data.objectives || []).map((obj: any) => ({
        id: obj.id || obj.uuid,
        subject: obj.subject,
        topic: obj.topic,
        description: obj.description,
        targetLevel: obj.target_level || 0,
        completed: obj.completed || false,
        completedAt: obj.completed_at ? new Date(obj.completed_at) : undefined,
        attempts: obj.attempts || 0,
        successRate: obj.success_rate || 0
      }));

      // Calculate overall completion rate
      const overallCompletionRate = subjectProgress.length > 0
        ? subjectProgress.reduce((sum, subject) => sum + subject.completionRate, 0) / subjectProgress.length
        : 0;

      return {
        childId: data.progress?.child_id || '',
        overallCompletionRate,
        subjectProgress,
        recentObjectives,
        nextMilestones: data.progress?.next_milestones || [],
        totalLearningTime: data.progress?.total_learning_time || 0,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Failed to transform current progress data:', error);
      return null;
    }
  }

  private transformWeeklyProgressData(data: any[]): WeeklyProgressData[] {
    return data.map((item) => ({
      week: item.week_label || `Week ${item.week_number}`,
      weekOf: item.week_label || `Week of ${new Date(item.week_start).toLocaleDateString()}`,
      data: {
        date: item.week_start,
        overallProgress: item.overall_progress || 0,
        subjects: item.subject_progress || {}
      }
    }));
  }

  private transformMonthlyProgressData(data: any[]): MonthlyProgressData[] {
    return data.map((item) => ({
      month: item.month_label || new Date(item.month_start).toLocaleDateString('en-US', { month: 'long' }),
      monthOf: item.month_label || new Date(item.month_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      data: {
        date: item.month_start,
        overallProgress: item.overall_progress || 0,
        subjects: item.subject_progress || {}
      }
    }));
  }

  async disconnect() {
    if (this.db) {
      try {
        // Clear all active subscriptions
        useProgressStore.getState().clearAllSubscriptions();

        // Close database connection
        await this.db.close();
        this.db = null;
        this.isInitialized = false;

        useProgressStore.getState().setConnectionStatus(false);
        console.log('SurrealDB connection closed');
      } catch (error) {
        console.error('Error disconnecting from SurrealDB:', error);
      }
    }
  }
}

export const realTimeProgressService = new RealTimeProgressService();