import winston from 'winston';
import { ProgressRepository } from './progressRepository';
import { SkillMasteryUpdate } from './progressTracking';
import { AgeGroup } from './chatgpt';

// Subject-specific skill definitions
export interface SkillDefinition {
  skillId: string;
  skillName: string;
  subject: 'mathematics' | 'reading' | 'science' | 'social_studies';
  category: string; // e.g., 'algebra', 'geometry', 'phonics', 'comprehension'
  description: string;
  prerequisites: string[]; // IDs of prerequisite skills
  masteryLevel: SkillLevel;
  ageGroups: AgeGroup[]; // Which age groups this skill applies to
  standardsAlignment: string[]; // Educational standards this skill aligns with
}

export type SkillLevel = 'not_started' | 'introduced' | 'developing' | 'practicing' | 'proficient' | 'mastered' | 'advanced';

export interface SkillMasteryRecord {
  childId: string;
  skillId: string;
  skillDefinition: SkillDefinition;
  currentLevel: SkillLevel;
  numericLevel: number; // 0-10 for calculations
  practiceCount: number;
  successRate: number; // 0-1
  lastPracticed: Date;
  masteryAchieved: Date | null;
  evidenceSources: SkillEvidence[];
  nextMilestone: string | null;
  confidence: number; // 0-1, confidence in current assessment
}

export interface SkillEvidence {
  evidenceType: 'voice_interaction' | 'photo_assessment' | 'objective_completion' | 'quiz_result';
  timestamp: Date;
  score: number; // 0-1
  confidence: number; // 0-1
  context: string; // Description of the learning context
  metadata?: Record<string, any>;
}

export interface SkillDependency {
  prerequisiteSkillId: string;
  dependentSkillId: string;
  dependencyStrength: number; // 0-1, how critical the prerequisite is
  subject: string;
}

export interface SubjectMasteryAnalysis {
  subject: string;
  childId: string;
  overallMastery: number; // 0-1
  skillBreakdown: {
    total: number;
    notStarted: number;
    introduced: number;
    developing: number;
    practicing: number;
    proficient: number;
    mastered: number;
    advanced: number;
  };
  strengthAreas: string[]; // Categories where child excels
  improvementAreas: string[]; // Categories needing work
  nextSkills: string[]; // Skills ready to be introduced
  blockedSkills: string[]; // Skills waiting for prerequisites
  recommendedActivities: string[];
}

export interface LearningPathRecommendation {
  childId: string;
  skillId: string;
  skillName: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  estimatedTimeToMastery: number; // in hours
  recommendedActivities: string[];
  prerequisites: string[];
  difficulty: number; // 1-10
}

/**
 * Skill Mastery Service
 *
 * Tracks individual skill progression across mathematics, reading, science, and social studies.
 * Provides detailed analytics and learning path recommendations.
 */
export class SkillMasteryService {
  private logger: winston.Logger;
  private repository: ProgressRepository;
  private skillDefinitions: Map<string, SkillDefinition> = new Map();
  private skillDependencies: Map<string, SkillDependency[]> = new Map();

  constructor(repository: ProgressRepository, logger: winston.Logger) {
    this.repository = repository;
    this.logger = logger;
    this.logger.info('SkillMasteryService initialized');

    // Initialize skill definitions
    this.initializeSkillDefinitions();
  }

  /**
   * Update skill mastery for a child based on new evidence
   */
  async updateSkillMastery(
    childId: string,
    skillId: string,
    evidence: SkillEvidence
  ): Promise<SkillMasteryRecord> {
    try {
      // Get current skill record or create new one
      let skillRecord = await this.getSkillMastery(childId, skillId);

      if (!skillRecord) {
        skillRecord = await this.createInitialSkillRecord(childId, skillId);
      }

      // Add new evidence
      skillRecord.evidenceSources.push(evidence);
      skillRecord.lastPracticed = evidence.timestamp;
      skillRecord.practiceCount++;

      // Recalculate mastery metrics
      this.recalculateSkillMetrics(skillRecord);

      // Save updated record
      const skillUpdate: SkillMasteryUpdate = {
        skillId,
        skillName: skillRecord.skillDefinition.skillName,
        previousLevel: this.levelToNumeric(skillRecord.currentLevel),
        newLevel: skillRecord.numericLevel,
        evidenceSource: evidence.evidenceType,
        confidence: evidence.confidence,
        timestamp: evidence.timestamp
      };

      await this.repository.saveSkillMasteryUpdates(childId, [skillUpdate]);

      this.logger.debug('Skill mastery updated', {
        childId,
        skillId,
        currentLevel: skillRecord.currentLevel,
        practiceCount: skillRecord.practiceCount,
        successRate: skillRecord.successRate
      });

      return skillRecord;

    } catch (error) {
      this.logger.error('Failed to update skill mastery', {
        error: error instanceof Error ? error.message : error,
        childId,
        skillId
      });
      throw error;
    }
  }

  /**
   * Get skill mastery record for a child and skill
   */
  async getSkillMastery(childId: string, skillId: string): Promise<SkillMasteryRecord | null> {
    try {
      const skillUpdates = await this.repository.getChildSkillMastery(childId);
      const skillUpdate = skillUpdates.find(update => update.skillId === skillId);

      if (!skillUpdate) {
        return null;
      }

      const skillDefinition = this.skillDefinitions.get(skillId);
      if (!skillDefinition) {
        this.logger.warn('Skill definition not found', { skillId });
        return null;
      }

      // Convert stored update to full skill record
      return this.buildSkillRecord(childId, skillDefinition, skillUpdate);

    } catch (error) {
      this.logger.error('Failed to get skill mastery', {
        error: error instanceof Error ? error.message : error,
        childId,
        skillId
      });
      return null;
    }
  }

  /**
   * Get all skill mastery records for a child in a subject
   */
  async getSubjectMastery(childId: string, subject: string): Promise<SkillMasteryRecord[]> {
    try {
      const allSkillUpdates = await this.repository.getChildSkillMastery(childId, subject);
      const skillRecords: SkillMasteryRecord[] = [];

      for (const update of allSkillUpdates) {
        const skillDefinition = this.skillDefinitions.get(update.skillId);
        if (skillDefinition && skillDefinition.subject === subject) {
          const record = this.buildSkillRecord(childId, skillDefinition, update);
          skillRecords.push(record);
        }
      }

      return skillRecords;

    } catch (error) {
      this.logger.error('Failed to get subject mastery', {
        error: error instanceof Error ? error.message : error,
        childId,
        subject
      });
      return [];
    }
  }

  /**
   * Analyze subject mastery and provide recommendations
   */
  async analyzeSubjectMastery(childId: string, subject: string): Promise<SubjectMasteryAnalysis> {
    try {
      const skillRecords = await this.getSubjectMastery(childId, subject);
      const subjectSkills = Array.from(this.skillDefinitions.values())
        .filter(skill => skill.subject === subject);

      // Calculate skill breakdown
      const skillBreakdown = {
        total: subjectSkills.length,
        notStarted: 0,
        introduced: 0,
        developing: 0,
        practicing: 0,
        proficient: 0,
        mastered: 0,
        advanced: 0
      };

      const levelCounts: Record<string, number> = {};

      skillRecords.forEach(record => {
        const level = record.currentLevel;
        levelCounts[level] = (levelCounts[level] || 0) + 1;
      });

      // Map to breakdown structure
      skillBreakdown.notStarted = levelCounts.not_started || 0;
      skillBreakdown.introduced = levelCounts.introduced || 0;
      skillBreakdown.developing = levelCounts.developing || 0;
      skillBreakdown.practicing = levelCounts.practicing || 0;
      skillBreakdown.proficient = levelCounts.proficient || 0;
      skillBreakdown.mastered = levelCounts.mastered || 0;
      skillBreakdown.advanced = levelCounts.advanced || 0;

      // Calculate overall mastery
      const totalMasteryPoints = skillRecords.reduce((sum, record) => sum + record.numericLevel, 0);
      const maxPossiblePoints = skillRecords.length * 10;
      const overallMastery = maxPossiblePoints > 0 ? totalMasteryPoints / maxPossiblePoints : 0;

      // Identify strength and improvement areas
      const categoryAnalysis = this.analyzeCategoryPerformance(skillRecords);
      const strengthAreas = categoryAnalysis.strong;
      const improvementAreas = categoryAnalysis.weak;

      // Determine next skills and blocked skills
      const { nextSkills, blockedSkills } = await this.analyzeSkillReadiness(childId, subject, skillRecords);

      // Generate activity recommendations
      const recommendedActivities = this.generateActivityRecommendations(subject, improvementAreas, nextSkills);

      return {
        subject,
        childId,
        overallMastery,
        skillBreakdown,
        strengthAreas,
        improvementAreas,
        nextSkills,
        blockedSkills,
        recommendedActivities
      };

    } catch (error) {
      this.logger.error('Failed to analyze subject mastery', {
        error: error instanceof Error ? error.message : error,
        childId,
        subject
      });
      throw error;
    }
  }

  /**
   * Generate learning path recommendations for a child
   */
  async generateLearningPath(
    childId: string,
    subject?: string,
    targetSkills?: string[]
  ): Promise<LearningPathRecommendation[]> {
    try {
      const recommendations: LearningPathRecommendation[] = [];
      const subjects = subject ? [subject] : ['mathematics', 'reading', 'science', 'social_studies'];

      for (const subj of subjects) {
        const analysis = await this.analyzeSubjectMastery(childId, subj);

        // Prioritize next skills
        for (const skillId of analysis.nextSkills) {
          const skillDef = this.skillDefinitions.get(skillId);
          if (!skillDef) continue;

          const recommendation: LearningPathRecommendation = {
            childId,
            skillId,
            skillName: skillDef.skillName,
            priority: this.calculateSkillPriority(skillDef, analysis),
            reasoning: this.generateRecommendationReasoning(skillDef, analysis),
            estimatedTimeToMastery: this.estimateTimeToMastery(skillDef),
            recommendedActivities: this.getSkillActivities(skillDef),
            prerequisites: skillDef.prerequisites,
            difficulty: this.calculateSkillDifficulty(skillDef)
          };

          recommendations.push(recommendation);
        }

        // Include improvement areas
        for (const category of analysis.improvementAreas) {
          const categorySkills = Array.from(this.skillDefinitions.values())
            .filter(skill => skill.subject === subj && skill.category === category);

          for (const skillDef of categorySkills) {
            if (targetSkills && !targetSkills.includes(skillDef.skillId)) continue;

            const recommendation: LearningPathRecommendation = {
              childId,
              skillId: skillDef.skillId,
              skillName: skillDef.skillName,
              priority: 'high',
              reasoning: `Improvement needed in ${category}`,
              estimatedTimeToMastery: this.estimateTimeToMastery(skillDef) * 1.5, // More time for improvement
              recommendedActivities: this.getRemediationActivities(skillDef),
              prerequisites: skillDef.prerequisites,
              difficulty: this.calculateSkillDifficulty(skillDef)
            };

            recommendations.push(recommendation);
          }
        }
      }

      // Sort by priority and return top recommendations
      return recommendations
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
        .slice(0, 10); // Top 10 recommendations

    } catch (error) {
      this.logger.error('Failed to generate learning path', {
        error: error instanceof Error ? error.message : error,
        childId,
        subject
      });
      throw error;
    }
  }

  /**
   * Calculate skill dependency impact
   */
  async calculateDependencyImpact(skillId: string): Promise<{
    blockedSkills: string[];
    criticalPath: boolean;
    impactScore: number;
  }> {
    try {
      const dependencies = this.skillDependencies.get(skillId) || [];
      const blockedSkills = dependencies.map(dep => dep.dependentSkillId);

      // Calculate impact score based on number of dependent skills and their importance
      let impactScore = blockedSkills.length;

      // Check if this skill is on a critical learning path
      const criticalPath = dependencies.some(dep => dep.dependencyStrength > 0.8);

      if (criticalPath) {
        impactScore *= 2; // Double impact for critical path skills
      }

      return {
        blockedSkills,
        criticalPath,
        impactScore
      };

    } catch (error) {
      this.logger.error('Failed to calculate dependency impact', {
        error: error instanceof Error ? error.message : error,
        skillId
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private initializeSkillDefinitions(): void {
    // Initialize mathematics skills
    this.addMathematicsSkills();

    // Initialize reading skills
    this.addReadingSkills();

    // Initialize science skills
    this.addScienceSkills();

    // Initialize social studies skills
    this.addSocialStudiesSkills();

    this.logger.info('Skill definitions initialized', {
      totalSkills: this.skillDefinitions.size
    });
  }

  private addMathematicsSkills(): void {
    const mathSkills: SkillDefinition[] = [
      {
        skillId: 'math-counting-1-10',
        skillName: 'Counting 1-10',
        subject: 'mathematics',
        category: 'number_sense',
        description: 'Count objects from 1 to 10',
        prerequisites: [],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9'],
        standardsAlignment: ['K.CC.A.1']
      },
      {
        skillId: 'math-addition-single-digit',
        skillName: 'Single Digit Addition',
        subject: 'mathematics',
        category: 'arithmetic',
        description: 'Add single digit numbers',
        prerequisites: ['math-counting-1-10'],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9'],
        standardsAlignment: ['1.OA.A.1']
      },
      {
        skillId: 'math-subtraction-single-digit',
        skillName: 'Single Digit Subtraction',
        subject: 'mathematics',
        category: 'arithmetic',
        description: 'Subtract single digit numbers',
        prerequisites: ['math-addition-single-digit'],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9'],
        standardsAlignment: ['1.OA.A.1']
      },
      {
        skillId: 'math-multiplication-tables',
        skillName: 'Multiplication Tables',
        subject: 'mathematics',
        category: 'arithmetic',
        description: 'Memorize multiplication tables 1-12',
        prerequisites: ['math-addition-single-digit'],
        masteryLevel: 'mastered',
        ageGroups: ['ages6to9', 'ages10to13'],
        standardsAlignment: ['3.OA.C.7']
      },
      {
        skillId: 'math-fractions-basic',
        skillName: 'Basic Fractions',
        subject: 'mathematics',
        category: 'fractions',
        description: 'Understand halves, thirds, and quarters',
        prerequisites: ['math-counting-1-10'],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9', 'ages10to13'],
        standardsAlignment: ['2.G.A.3']
      },
      {
        skillId: 'math-algebra-linear-equations',
        skillName: 'Linear Equations',
        subject: 'mathematics',
        category: 'algebra',
        description: 'Solve simple linear equations',
        prerequisites: ['math-multiplication-tables', 'math-subtraction-single-digit'],
        masteryLevel: 'proficient',
        ageGroups: ['ages10to13', 'ages14to16'],
        standardsAlignment: ['6.EE.B.7']
      }
    ];

    mathSkills.forEach(skill => {
      this.skillDefinitions.set(skill.skillId, skill);
    });

    // Add dependencies
    this.addSkillDependency('math-counting-1-10', 'math-addition-single-digit', 1.0, 'mathematics');
    this.addSkillDependency('math-addition-single-digit', 'math-subtraction-single-digit', 0.9, 'mathematics');
    this.addSkillDependency('math-addition-single-digit', 'math-multiplication-tables', 0.8, 'mathematics');
    this.addSkillDependency('math-multiplication-tables', 'math-algebra-linear-equations', 0.7, 'mathematics');
  }

  private addReadingSkills(): void {
    const readingSkills: SkillDefinition[] = [
      {
        skillId: 'reading-letter-recognition',
        skillName: 'Letter Recognition',
        subject: 'reading',
        category: 'phonics',
        description: 'Recognize all uppercase and lowercase letters',
        prerequisites: [],
        masteryLevel: 'mastered',
        ageGroups: ['ages6to9'],
        standardsAlignment: ['RF.K.1.D']
      },
      {
        skillId: 'reading-phonetic-sounds',
        skillName: 'Phonetic Sounds',
        subject: 'reading',
        category: 'phonics',
        description: 'Associate letters with their sounds',
        prerequisites: ['reading-letter-recognition'],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9'],
        standardsAlignment: ['RF.K.3.A']
      },
      {
        skillId: 'reading-sight-words-basic',
        skillName: 'Basic Sight Words',
        subject: 'reading',
        category: 'vocabulary',
        description: 'Recognize common sight words',
        prerequisites: ['reading-letter-recognition'],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9'],
        standardsAlignment: ['RF.K.3.C']
      },
      {
        skillId: 'reading-comprehension-basic',
        skillName: 'Basic Reading Comprehension',
        subject: 'reading',
        category: 'comprehension',
        description: 'Understand simple sentences and passages',
        prerequisites: ['reading-phonetic-sounds', 'reading-sight-words-basic'],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9', 'ages10to13'],
        standardsAlignment: ['RL.1.1']
      }
    ];

    readingSkills.forEach(skill => {
      this.skillDefinitions.set(skill.skillId, skill);
    });

    // Add dependencies
    this.addSkillDependency('reading-letter-recognition', 'reading-phonetic-sounds', 1.0, 'reading');
    this.addSkillDependency('reading-letter-recognition', 'reading-sight-words-basic', 0.8, 'reading');
    this.addSkillDependency('reading-phonetic-sounds', 'reading-comprehension-basic', 0.9, 'reading');
    this.addSkillDependency('reading-sight-words-basic', 'reading-comprehension-basic', 0.7, 'reading');
  }

  private addScienceSkills(): void {
    const scienceSkills: SkillDefinition[] = [
      {
        skillId: 'science-living-nonliving',
        skillName: 'Living vs Non-Living',
        subject: 'science',
        category: 'biology',
        description: 'Distinguish between living and non-living things',
        prerequisites: [],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9'],
        standardsAlignment: ['1-LS1-1']
      },
      {
        skillId: 'science-animal-habitats',
        skillName: 'Animal Habitats',
        subject: 'science',
        category: 'biology',
        description: 'Understand where different animals live',
        prerequisites: ['science-living-nonliving'],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9', 'ages10to13'],
        standardsAlignment: ['2-LS4-1']
      },
      {
        skillId: 'science-states-of-matter',
        skillName: 'States of Matter',
        subject: 'science',
        category: 'chemistry',
        description: 'Understand solid, liquid, and gas states',
        prerequisites: [],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9', 'ages10to13'],
        standardsAlignment: ['2-PS1-1']
      }
    ];

    scienceSkills.forEach(skill => {
      this.skillDefinitions.set(skill.skillId, skill);
    });

    // Add dependencies
    this.addSkillDependency('science-living-nonliving', 'science-animal-habitats', 0.8, 'science');
  }

  private addSocialStudiesSkills(): void {
    const socialStudiesSkills: SkillDefinition[] = [
      {
        skillId: 'social-community-helpers',
        skillName: 'Community Helpers',
        subject: 'social_studies',
        category: 'community',
        description: 'Identify people who help in the community',
        prerequisites: [],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9'],
        standardsAlignment: ['NCSS.II.5']
      },
      {
        skillId: 'social-basic-geography',
        skillName: 'Basic Geography',
        subject: 'social_studies',
        category: 'geography',
        description: 'Understand maps, directions, and locations',
        prerequisites: [],
        masteryLevel: 'proficient',
        ageGroups: ['ages6to9', 'ages10to13'],
        standardsAlignment: ['NCSS.III.2']
      }
    ];

    socialStudiesSkills.forEach(skill => {
      this.skillDefinitions.set(skill.skillId, skill);
    });
  }

  private addSkillDependency(prerequisite: string, dependent: string, strength: number, subject: string): void {
    if (!this.skillDependencies.has(prerequisite)) {
      this.skillDependencies.set(prerequisite, []);
    }

    this.skillDependencies.get(prerequisite)!.push({
      prerequisiteSkillId: prerequisite,
      dependentSkillId: dependent,
      dependencyStrength: strength,
      subject
    });
  }

  private async createInitialSkillRecord(childId: string, skillId: string): Promise<SkillMasteryRecord> {
    const skillDefinition = this.skillDefinitions.get(skillId);
    if (!skillDefinition) {
      throw new Error(`Skill definition not found: ${skillId}`);
    }

    return {
      childId,
      skillId,
      skillDefinition,
      currentLevel: 'not_started',
      numericLevel: 0,
      practiceCount: 0,
      successRate: 0,
      lastPracticed: new Date(),
      masteryAchieved: null,
      evidenceSources: [],
      nextMilestone: 'Begin practice',
      confidence: 0
    };
  }

  private buildSkillRecord(
    childId: string,
    skillDefinition: SkillDefinition,
    skillUpdate: SkillMasteryUpdate
  ): SkillMasteryRecord {
    return {
      childId,
      skillId: skillUpdate.skillId,
      skillDefinition,
      currentLevel: this.numericToLevel(skillUpdate.newLevel),
      numericLevel: skillUpdate.newLevel,
      practiceCount: 1, // Simplified for now
      successRate: skillUpdate.confidence,
      lastPracticed: skillUpdate.timestamp,
      masteryAchieved: skillUpdate.newLevel >= 8 ? skillUpdate.timestamp : null,
      evidenceSources: [{
        evidenceType: skillUpdate.evidenceSource,
        timestamp: skillUpdate.timestamp,
        score: skillUpdate.confidence,
        confidence: skillUpdate.confidence,
        context: 'Progress tracking update'
      }],
      nextMilestone: this.calculateNextMilestone(skillUpdate.newLevel),
      confidence: skillUpdate.confidence
    };
  }

  private recalculateSkillMetrics(skillRecord: SkillMasteryRecord): void {
    // Calculate success rate from all evidence
    const totalScore = skillRecord.evidenceSources.reduce((sum, evidence) => sum + evidence.score, 0);
    skillRecord.successRate = skillRecord.evidenceSources.length > 0 ?
      totalScore / skillRecord.evidenceSources.length : 0;

    // Calculate confidence as weighted average of recent evidence
    const recentEvidence = skillRecord.evidenceSources.slice(-5); // Last 5 pieces of evidence
    const totalConfidence = recentEvidence.reduce((sum, evidence) => sum + evidence.confidence, 0);
    skillRecord.confidence = recentEvidence.length > 0 ?
      totalConfidence / recentEvidence.length : 0;

    // Update numeric level based on success rate and practice count
    const baseLevel = Math.floor(skillRecord.successRate * 8);
    const practiceBonus = Math.min(2, skillRecord.practiceCount / 10);
    skillRecord.numericLevel = Math.min(10, baseLevel + practiceBonus);

    // Update current level
    skillRecord.currentLevel = this.numericToLevel(skillRecord.numericLevel);

    // Check for mastery achievement
    if (skillRecord.numericLevel >= 8 && !skillRecord.masteryAchieved) {
      skillRecord.masteryAchieved = new Date();
    }

    // Update next milestone
    skillRecord.nextMilestone = this.calculateNextMilestone(skillRecord.numericLevel);
  }

  private levelToNumeric(level: SkillLevel): number {
    const mapping: Record<SkillLevel, number> = {
      not_started: 0,
      introduced: 2,
      developing: 4,
      practicing: 6,
      proficient: 8,
      mastered: 9,
      advanced: 10
    };
    return mapping[level] || 0;
  }

  private numericToLevel(numeric: number): SkillLevel {
    if (numeric === 0) return 'not_started';
    if (numeric <= 2) return 'introduced';
    if (numeric <= 4) return 'developing';
    if (numeric <= 6) return 'practicing';
    if (numeric <= 8) return 'proficient';
    if (numeric === 9) return 'mastered';
    return 'advanced';
  }

  private calculateNextMilestone(numericLevel: number): string {
    if (numericLevel === 0) return 'Begin practice';
    if (numericLevel < 4) return 'Continue practicing basics';
    if (numericLevel < 6) return 'Work toward proficiency';
    if (numericLevel < 8) return 'Achieve consistent success';
    if (numericLevel < 9) return 'Demonstrate mastery';
    return 'Explore advanced concepts';
  }

  private analyzeCategoryPerformance(skillRecords: SkillMasteryRecord[]): {
    strong: string[];
    weak: string[];
  } {
    const categoryScores: Record<string, { total: number; count: number }> = {};

    skillRecords.forEach(record => {
      const category = record.skillDefinition.category;
      if (!categoryScores[category]) {
        categoryScores[category] = { total: 0, count: 0 };
      }
      categoryScores[category].total += record.numericLevel;
      categoryScores[category].count++;
    });

    const categoryAverages = Object.entries(categoryScores).map(([category, scores]) => ({
      category,
      average: scores.total / scores.count
    }));

    const overallAverage = categoryAverages.reduce((sum, cat) => sum + cat.average, 0) / categoryAverages.length;

    return {
      strong: categoryAverages.filter(cat => cat.average > overallAverage + 1).map(cat => cat.category),
      weak: categoryAverages.filter(cat => cat.average < overallAverage - 1).map(cat => cat.category)
    };
  }

  private async analyzeSkillReadiness(
    childId: string,
    subject: string,
    currentSkills: SkillMasteryRecord[]
  ): Promise<{ nextSkills: string[]; blockedSkills: string[] }> {
    const nextSkills: string[] = [];
    const blockedSkills: string[] = [];

    const subjectSkills = Array.from(this.skillDefinitions.values())
      .filter(skill => skill.subject === subject);

    const currentSkillIds = new Set(currentSkills.map(skill => skill.skillId));
    const masteredSkillIds = new Set(
      currentSkills
        .filter(skill => skill.numericLevel >= 6) // Practicing level or higher
        .map(skill => skill.skillId)
    );

    for (const skill of subjectSkills) {
      if (currentSkillIds.has(skill.skillId)) continue; // Already working on this skill

      const prerequisitesMet = skill.prerequisites.every(prereq => masteredSkillIds.has(prereq));

      if (prerequisitesMet) {
        nextSkills.push(skill.skillId);
      } else {
        blockedSkills.push(skill.skillId);
      }
    }

    return { nextSkills, blockedSkills };
  }

  private generateActivityRecommendations(
    subject: string,
    improvementAreas: string[],
    nextSkills: string[]
  ): string[] {
    const activities: string[] = [];

    // Add subject-specific activities
    if (subject === 'mathematics') {
      activities.push('Practice with manipulatives and visual aids');
      activities.push('Use interactive math games and apps');
      if (improvementAreas.includes('arithmetic')) {
        activities.push('Focus on addition and subtraction drills');
      }
      if (improvementAreas.includes('fractions')) {
        activities.push('Use fraction circles and bars for visual learning');
      }
    }

    if (subject === 'reading') {
      activities.push('Read aloud together daily');
      activities.push('Use phonics games and activities');
      if (improvementAreas.includes('comprehension')) {
        activities.push('Discuss stories and ask comprehension questions');
      }
    }

    if (subject === 'science') {
      activities.push('Conduct simple experiments and observations');
      activities.push('Explore nature and discuss findings');
    }

    if (subject === 'social_studies') {
      activities.push('Explore maps and discuss different places');
      activities.push('Learn about community helpers through role play');
    }

    return activities;
  }

  private calculateSkillPriority(
    skill: SkillDefinition,
    analysis: SubjectMasteryAnalysis
  ): 'high' | 'medium' | 'low' {
    // High priority for foundational skills
    if (skill.prerequisites.length === 0) return 'high';

    // High priority for improvement areas
    if (analysis.improvementAreas.includes(skill.category)) return 'high';

    // Medium priority for next logical steps
    return 'medium';
  }

  private generateRecommendationReasoning(
    skill: SkillDefinition,
    analysis: SubjectMasteryAnalysis
  ): string {
    if (skill.prerequisites.length === 0) {
      return 'Foundational skill that enables further learning';
    }

    if (analysis.improvementAreas.includes(skill.category)) {
      return `Strengthening ${skill.category} will improve overall performance`;
    }

    return 'Natural next step in learning progression';
  }

  private estimateTimeToMastery(skill: SkillDefinition): number {
    // Estimate based on skill complexity and typical learning patterns
    const baseHours: Record<string, number> = {
      'not_started': 10,
      'introduced': 8,
      'developing': 6,
      'practicing': 4,
      'proficient': 2,
      'mastered': 1,
      'advanced': 0.5
    };

    return baseHours[skill.masteryLevel] || 5;
  }

  private getSkillActivities(skill: SkillDefinition): string[] {
    // Return activity suggestions based on skill type
    const baseActivities = [
      'Interactive practice sessions',
      'Visual learning aids',
      'Real-world application exercises'
    ];

    if (skill.subject === 'mathematics') {
      baseActivities.push('Math manipulatives', 'Problem-solving games');
    } else if (skill.subject === 'reading') {
      baseActivities.push('Reading aloud', 'Phonics games');
    }

    return baseActivities;
  }

  private getRemediationActivities(skill: SkillDefinition): string[] {
    // More intensive activities for skills needing improvement
    return [
      'One-on-one focused practice',
      'Break down into smaller steps',
      'Use multi-sensory learning approaches',
      'Provide additional scaffolding'
    ];
  }

  private calculateSkillDifficulty(skill: SkillDefinition): number {
    // Difficulty from 1-10 based on prerequisites and complexity
    let difficulty = 3; // Base difficulty

    difficulty += skill.prerequisites.length; // More prerequisites = harder

    if (skill.masteryLevel === 'mastered' || skill.masteryLevel === 'advanced') {
      difficulty += 2;
    }

    return Math.min(10, difficulty);
  }
}

/**
 * Factory function to create SkillMasteryService
 */
export function createSkillMasteryService(
  repository: ProgressRepository,
  logger: winston.Logger
): SkillMasteryService {
  return new SkillMasteryService(repository, logger);
}