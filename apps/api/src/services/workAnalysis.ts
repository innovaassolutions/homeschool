import OpenAI from 'openai';
import type { AgeGroup } from './camera';

// Subject and content type definitions
export type SubjectType = 'mathematics' | 'english' | 'science' | 'history' | 'geography' | 'art' | 'general';

export type ContentType =
  | 'mathematical_problem'
  | 'writing_sample'
  | 'science_experiment'
  | 'historical_analysis'
  | 'creative_writing'
  | 'reading_comprehension'
  | 'vocabulary_exercise'
  | 'science_diagram'
  | 'timeline'
  | 'map_work'
  | 'art_critique'
  | 'general_notes';

// Analysis result interfaces
export interface OCRResult {
  extractedText: string;
  confidence: number;
  regions: TextRegion[];
  academicContent: AcademicContent[];
  detectedSubjects: SubjectType[];
  primaryContentType: ContentType;
  processingTime: number;
}

export interface TextRegion {
  id: string;
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: 'text' | 'number' | 'equation' | 'diagram' | 'writing' | 'drawing' | 'table' | 'list';
}

export interface AcademicContent {
  id: string;
  subject: SubjectType;
  contentType: ContentType;
  type: 'problem' | 'solution' | 'equation' | 'expression' | 'diagram' | 'paragraph' | 'sentence' | 'phrase' | 'list_item' | 'title' | 'question' | 'answer';
  content: string;
  confidence: number;
  position: {
    x: number;
    y: number;
  };
  relatedRegions: string[]; // TextRegion IDs
}

export interface WorkAnalysisResult {
  id: string;
  photoId: string;
  sessionId?: string;
  childId: string;
  ageGroup: AgeGroup;

  // OCR Results
  ocrResult: OCRResult;

  // Academic Analysis (supports all subjects)
  detectedSubjects: SubjectType[];
  primarySubject: SubjectType;
  identifiedProblems: AcademicProblem[];
  contentAnalysis: ContentAnalysis[];

  // Educational Assessment
  skillAssessment: SkillAssessment;
  errorAnalysis: ErrorAnalysis;

  // Feedback
  feedback: EducationalFeedback;

  // Metadata
  analysisTimestamp: Date;
  processingDuration: number;
  analysisVersion: string;
  confidence: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'unclear';
}

export interface AcademicProblem {
  id: string;
  subject: SubjectType;
  contentType: ContentType;
  type: 'arithmetic' | 'algebra' | 'geometry' | 'word_problem' | 'multi_step' | 'essay_question' | 'comprehension' | 'vocabulary' | 'experiment' | 'analysis' | 'creative_task' | 'research';
  difficulty: 'elementary' | 'middle' | 'high_school';
  problem: string;
  expectedAnswer?: string;
  rubricCriteria?: string[];
  concepts: string[];
  gradeLevel: number;
}

export interface ContentAnalysis {
  problemId: string;
  subject: SubjectType;
  studentWork: string;
  analysisType: 'solution' | 'essay' | 'creative_writing' | 'comprehension' | 'vocabulary' | 'experiment_notes' | 'research';
  steps: AnalysisStep[];
  isCorrect?: boolean; // Optional for non-objective content
  accuracy: number;
  approach: 'standard' | 'creative' | 'incomplete' | 'incorrect' | 'innovative' | 'thoughtful';
  completeness: number; // 0-1 scale
  qualityMetrics: QualityMetrics;
}

export interface QualityMetrics {
  clarity: number; // 0-1 scale
  organization: number;
  creativity: number;
  criticalThinking: number;
  grammarMechanics?: number; // For writing
  scientificAccuracy?: number; // For science
  historicalAccuracy?: number; // For history
}

export interface AnalysisStep {
  stepNumber: number;
  content: string;
  isCorrect?: boolean; // Optional for subjective content
  operation?: string; // For math/science
  reasoning: string;
  feedback?: string;
  subjectSpecificNotes?: string;
}

export interface SkillAssessment {
  subjectSkills: Record<SubjectType, SubjectSkills>;
  overallSkills: string[];
  crossCurricularSkills: string[];
  skillLevels: Record<string, number>; // skill -> proficiency (0-1)
  strengthAreas: string[];
  improvementAreas: string[];
  gradeEquivalency: Record<SubjectType, number>;
  readinessForAdvancement: boolean;
  overallAccuracy: number;
}

export interface SubjectSkills {
  demonstratedSkills: string[];
  proficiencyLevel: number; // 0-1 scale
  gradeLevel: number;
  nextSteps: string[];
}

export interface ErrorAnalysis {
  errorTypes: ErrorType[];
  misconceptions: string[];
  patterns: ErrorPattern[];
  severity: 'minor' | 'moderate' | 'significant';
  remediation: RemediationSuggestion[];
}

export interface ErrorType {
  subject: SubjectType;
  category: 'computational' | 'conceptual' | 'procedural' | 'careless' | 'grammatical' | 'factual' | 'analytical' | 'creative' | 'organizational';
  description: string;
  examples: string[];
  frequency: number;
  impact: 'low' | 'medium' | 'high';
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  contexts: string[];
  suggestedIntervention: string;
}

export interface RemediationSuggestion {
  skill: string;
  recommendation: string;
  practiceActivities: string[];
  estimatedTime: string;
  priority: 'low' | 'medium' | 'high';
}

export interface EducationalFeedback {
  overallAssessment: string;
  subjectFeedback: Record<SubjectType, SubjectFeedback>;
  crossCurricularInsights: string[];
  encouragement: string;
  nextSteps: string[];
  questionsForStudent: string[];
  ageAdaptivePresentation: AgeAdaptiveFeedback;
}

export interface SubjectFeedback {
  subject: SubjectType;
  assessment: string;
  specificFeedback: FeedbackItem[];
  skillHighlights: string[];
  improvementAreas: string[];
  nextLearningGoals: string[];
}

export interface FeedbackItem {
  type: 'praise' | 'correction' | 'suggestion' | 'question' | 'insight' | 'connection';
  subject?: SubjectType;
  content: string;
  relatedProblem?: string;
  importance: 'high' | 'medium' | 'low';
  pedagogicalNote?: string;
}

export interface AgeAdaptiveFeedback {
  ageGroup: AgeGroup;
  simplifiedLanguage: string;
  visualCues: string[];
  interactionStyle: 'encouraging' | 'detailed' | 'analytical';
  complexityLevel: number; // 1-5 scale
}

// Analysis configuration
export interface AnalysisConfig {
  ageGroup: AgeGroup;
  expectedSubjects: SubjectType[];
  primarySubject?: SubjectType; // If known, helps focus analysis
  contentTypes: ContentType[];
  difficultySensitivity: number; // 0-1, how strict to be about errors
  feedbackDetailLevel: 'basic' | 'detailed' | 'comprehensive';
  focusAreas: string[]; // specific skills to emphasize
  subjectSpecificSettings: Record<SubjectType, SubjectAnalysisSettings>;
  timeoutSeconds: number;
}

export interface SubjectAnalysisSettings {
  enabled: boolean;
  analysisDepth: 'surface' | 'moderate' | 'deep';
  feedbackStyle: 'encouraging' | 'analytical' | 'creative';
  specificCriteria: string[];
}

/**
 * Academic Work Analysis Service
 * Handles OCR, multi-subject content analysis, and educational assessment
 * Supports mathematics, English, science, history, geography, art, and general content
 */
export class WorkAnalysisService {
  private openai: OpenAI;
  private analysisVersion = '1.0.0';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Analyze handwritten work from photo
   */
  async analyzeWork(
    photoId: string,
    imageBuffer: Buffer,
    childId: string,
    ageGroup: AgeGroup,
    sessionId?: string,
    config?: Partial<AnalysisConfig>
  ): Promise<WorkAnalysisResult> {
    const startTime = Date.now();

    try {
      const analysisConfig = this.buildAnalysisConfig(ageGroup, config);

      // Step 1: OCR and content extraction
      const ocrResult = await this.performOCR(imageBuffer, analysisConfig);

      // Step 2: Mathematical content analysis
      const problems = await this.identifyAcademicProblems(ocrResult, analysisConfig);
      const solutions = await this.analyzeSolutions(problems, ocrResult, analysisConfig);

      // Step 3: Educational assessment
      const skillAssessment = await this.assessSkills(problems, solutions, ageGroup);
      const errorAnalysis = await this.analyzeErrors(solutions, ageGroup);

      // Step 4: Generate feedback
      const feedback = await this.generateFeedback(
        problems,
        solutions,
        skillAssessment,
        errorAnalysis,
        analysisConfig
      );

      const processingDuration = Date.now() - startTime;

      const result: WorkAnalysisResult = {
        id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        photoId,
        ...(sessionId && { sessionId }),
        childId,
        ageGroup,
        ocrResult,
        detectedSubjects: ocrResult.detectedSubjects,
        primarySubject: ocrResult.primaryContentType === 'mathematical_problem' ? 'mathematics' : 'general',
        identifiedProblems: problems,
        contentAnalysis: solutions,
        skillAssessment,
        errorAnalysis,
        feedback,
        analysisTimestamp: new Date(),
        processingDuration,
        analysisVersion: this.analysisVersion,
        confidence: this.calculateOverallConfidence(ocrResult, solutions),
        status: 'completed'
      };

      console.log(`✅ Work analysis completed for photo ${photoId} in ${processingDuration}ms`);
      return result;

    } catch (error) {
      console.error('Work analysis failed:', error);

      const processingDuration = Date.now() - startTime;

      const emptyOCR = this.createEmptyOCRResult();
      return {
        id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        photoId,
        ...(sessionId && { sessionId }),
        childId,
        ageGroup,
        ocrResult: emptyOCR,
        detectedSubjects: [],
        primarySubject: 'general',
        identifiedProblems: [],
        contentAnalysis: [],
        skillAssessment: this.createEmptySkillAssessment(),
        errorAnalysis: this.createEmptyErrorAnalysis(),
        feedback: this.createErrorFeedback(ageGroup, error),
        analysisTimestamp: new Date(),
        processingDuration,
        analysisVersion: this.analysisVersion,
        confidence: 0,
        status: 'failed'
      };
    }
  }

  /**
   * Perform OCR using ChatGPT-4 Vision
   */
  private async performOCR(
    imageBuffer: Buffer,
    config: AnalysisConfig
  ): Promise<OCRResult> {
    const startTime = Date.now();

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg'; // Assuming JPEG from camera

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.buildOCRPrompt(config)
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1 // Low temperature for consistency
      });

      const analysisText = response.choices[0]?.message?.content || '';

      // Parse the structured response
      const ocrResult = this.parseOCRResponse(analysisText);
      ocrResult.processingTime = Date.now() - startTime;

      console.log(`📝 OCR completed: ${ocrResult.extractedText.length} chars, confidence: ${ocrResult.confidence}`);

      return ocrResult;

    } catch (error) {
      console.error('OCR processing failed:', error);

      return {
        extractedText: '',
        confidence: 0,
        regions: [],
        academicContent: [],
        detectedSubjects: [],
        primaryContentType: 'general_notes',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Build OCR prompt based on age group and configuration
   */
  private buildOCRPrompt(config: AnalysisConfig): string {
    const ageContext = this.getAgeContext(config.ageGroup);
    const subjectContexts = this.getSubjectContexts(config.expectedSubjects);

    return `
Please analyze this handwritten student work image and extract all text, content, and academic material across multiple subjects.

CONTEXT:
- Student age group: ${config.ageGroup} (${ageContext})
- Expected subjects: ${config.expectedSubjects.join(', ')}
- Content types to look for: ${config.contentTypes.join(', ')}
- Focus areas: ${config.focusAreas.join(', ')}

SUBJECT GUIDELINES:
${subjectContexts}

EXTRACT:
1. All written text, numbers, and symbols
2. Mathematical equations and expressions
3. Written paragraphs and sentences
4. Problem statements and solutions
5. Diagrams, drawings, or visual elements
6. Lists, tables, or organized content
7. Any other academic content

PROVIDE RESPONSE IN THIS FORMAT:
EXTRACTED_TEXT: [All visible text in reading order]
CONFIDENCE: [0-100 score for extraction confidence]
DETECTED_SUBJECTS: [List subjects identified: mathematics, english, science, history, geography, art, general]
PRIMARY_CONTENT_TYPE: [Main type: mathematical_problem, writing_sample, science_experiment, etc.]
ACADEMIC_CONTENT: [Detailed breakdown by subject and type]
PROBLEMS: [List each problem/question found, any subject]
SOLUTIONS: [List each solution/answer attempt found]
NOTES: [Observations about handwriting, clarity, subject matter, etc.]

Be especially careful with:
- Mathematical symbols (+, -, ×, ÷, =, fractions, etc.)
- Proper grammar and punctuation in written text
- Scientific notation, formulas, and diagrams
- Historical dates, names, and events
- Geographic locations and features
- Artistic techniques and observations
    `.trim();
  }

  /**
   * Get age-appropriate context information
   */
  private getAgeContext(ageGroup: AgeGroup): string {
    switch (ageGroup) {
      case 'ages6to9':
        return 'Elementary school: basic reading/writing, simple sentences, basic arithmetic, science observations, simple maps';
      case 'ages10to13':
        return 'Middle school: paragraphs, reports, multi-step problems, fractions, basic experiments, historical timelines';
      case 'ages14to16':
        return 'High school: essays, advanced math, complex scientific concepts, detailed historical analysis, critical thinking';
      default:
        return 'General academic content';
    }
  }

  /**
   * Get subject-specific context guidelines
   */
  private getSubjectContexts(subjects: SubjectType[]): string {
    const contexts: string[] = [];

    subjects.forEach(subject => {
      switch (subject) {
        case 'mathematics':
          contexts.push('• MATH: Numbers, equations, geometric shapes, word problems, calculations, graphs');
          break;
        case 'english':
          contexts.push('• ENGLISH: Written text, essays, stories, grammar exercises, vocabulary, reading comprehension');
          break;
        case 'science':
          contexts.push('• SCIENCE: Experiments, observations, diagrams, formulas, lab notes, scientific method');
          break;
        case 'history':
          contexts.push('• HISTORY: Dates, events, timelines, historical figures, cause/effect, primary sources');
          break;
        case 'geography':
          contexts.push('• GEOGRAPHY: Maps, locations, landforms, countries, capitals, climate, regions');
          break;
        case 'art':
          contexts.push('• ART: Sketches, techniques, color theory, art history, critiques, creative expressions');
          break;
        case 'general':
          contexts.push('• GENERAL: Mixed content, notes, lists, personal writing, study materials');
          break;
      }
    });

    return contexts.join('\n');
  }

  /**
   * Parse OCR response from ChatGPT
   */
  private parseOCRResponse(response: string): OCRResult {
    const extractedText = this.extractSection(response, 'EXTRACTED_TEXT') || '';
    const confidenceStr = this.extractSection(response, 'CONFIDENCE') || '0';
    const confidence = Math.min(100, Math.max(0, parseInt(confidenceStr) || 0)) / 100;

    // Parse detected subjects
    const detectedSubjectsStr = this.extractSection(response, 'DETECTED_SUBJECTS') || 'general';
    const detectedSubjects = this.parseSubjects(detectedSubjectsStr);

    // Parse primary content type
    const primaryContentTypeStr = this.extractSection(response, 'PRIMARY_CONTENT_TYPE') || 'general_notes';
    const primaryContentType = this.parseContentType(primaryContentTypeStr);

    // Create regions from extracted content
    const regions: TextRegion[] = [];
    const academicContent: AcademicContent[] = [];

    if (extractedText) {
      // Create main text region
      regions.push({
        id: 'main_text',
        text: extractedText,
        confidence,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        type: this.determineRegionType(extractedText, primaryContentType)
      });

      // Parse academic content by subject
      detectedSubjects.forEach((subject, subjectIndex) => {
        const subjectContent = this.extractSubjectContent(extractedText, subject, primaryContentType);
        if (subjectContent.length > 0) {
          subjectContent.forEach((content, contentIndex) => {
            academicContent.push({
              id: `${subject}_${subjectIndex}_${contentIndex}`,
              subject,
              contentType: primaryContentType,
              type: content.type,
              content: content.content,
              confidence,
              position: { x: 0, y: 0 },
              relatedRegions: ['main_text']
            });
          });
        }
      });
    }

    return {
      extractedText,
      confidence,
      regions,
      academicContent,
      detectedSubjects,
      primaryContentType,
      processingTime: 0 // Will be set by caller
    };
  }

  /**
   * Parse subjects from response string
   */
  private parseSubjects(subjectsStr: string): SubjectType[] {
    const subjects: SubjectType[] = [];
    const validSubjects: SubjectType[] = ['mathematics', 'english', 'science', 'history', 'geography', 'art', 'general'];

    validSubjects.forEach(subject => {
      if (subjectsStr.toLowerCase().includes(subject)) {
        subjects.push(subject);
      }
    });

    return subjects.length > 0 ? subjects : ['general'];
  }

  /**
   * Parse content type from response string
   */
  private parseContentType(contentTypeStr: string): ContentType {
    const validTypes: ContentType[] = [
      'mathematical_problem', 'writing_sample', 'science_experiment',
      'historical_analysis', 'creative_writing', 'reading_comprehension',
      'vocabulary_exercise', 'science_diagram', 'timeline', 'map_work',
      'art_critique', 'general_notes'
    ];

    const lowerStr = contentTypeStr.toLowerCase();
    const matchedType = validTypes.find(type => lowerStr.includes(type));
    return matchedType || 'general_notes';
  }

  /**
   * Determine region type based on content
   */
  private determineRegionType(text: string, contentType: ContentType): TextRegion['type'] {
    if (contentType.includes('mathematical') || /\d+\s*[+\-×÷=]\s*\d+/.test(text)) {
      return 'equation';
    }
    if (contentType.includes('diagram') || text.includes('diagram') || text.includes('drawing')) {
      return 'diagram';
    }
    if (/^\d+/.test(text.trim())) {
      return 'number';
    }
    return 'text';
  }

  /**
   * Extract subject-specific content from text
   */
  private extractSubjectContent(text: string, subject: SubjectType, _contentType: ContentType): Array<{type: AcademicContent['type'], content: string}> {
    const content: Array<{type: AcademicContent['type'], content: string}> = [];

    switch (subject) {
      case 'mathematics':
        // Look for mathematical expressions, equations, problems
        const mathPatterns = [
          { pattern: /\d+\s*[+\-×÷]\s*\d+\s*=\s*\d+/g, type: 'equation' as const },
          { pattern: /\d+\s*[+\-×÷]\s*\d+/g, type: 'expression' as const },
          { pattern: /\d+\/\d+/g, type: 'expression' as const }
        ];

        mathPatterns.forEach(({ pattern, type }) => {
          const matches = text.match(pattern);
          if (matches) {
            matches.forEach(match => {
              content.push({ type, content: match });
            });
          }
        });
        break;

      case 'english':
        // Look for sentences, paragraphs, questions
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
        sentences.forEach(sentence => {
          if (sentence.includes('?')) {
            content.push({ type: 'question', content: sentence.trim() });
          } else {
            content.push({ type: 'sentence', content: sentence.trim() });
          }
        });
        break;

      case 'science':
        // Look for observations, experiments, formulas
        if (text.includes('observe') || text.includes('experiment') || text.includes('hypothesis')) {
          content.push({ type: 'problem', content: text });
        }
        break;

      case 'history':
        // Look for dates, events, names
        const datePattern = /\b\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
        const dates = text.match(datePattern);
        if (dates) {
          dates.forEach(date => {
            content.push({ type: 'phrase', content: date });
          });
        }
        break;

      default:
        // General content
        content.push({ type: 'paragraph', content: text });
    }

    return content;
  }

  /**
   * Extract section from structured response
   */
  private extractSection(response: string, sectionName: string): string | null {
    const regex = new RegExp(`${sectionName}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 'is');
    const match = response.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Identify mathematical problems in OCR result
   */
  private async identifyAcademicProblems(
    ocrResult: OCRResult,
    config: AnalysisConfig
  ): Promise<AcademicProblem[]> {
    if (!ocrResult.extractedText.trim()) {
      return [];
    }

    // Use ChatGPT to identify and classify problems
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: this.buildProblemIdentificationPrompt(config)
          },
          {
            role: 'user',
            content: `Please analyze this extracted text and identify mathematical problems:\n\n${ocrResult.extractedText}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });

      const analysisText = response.choices[0]?.message?.content || '';
      return this.parseProblemIdentification(analysisText);

    } catch (error) {
      console.error('Problem identification failed:', error);
      return [];
    }
  }

  /**
   * Build problem identification prompt
   */
  private buildProblemIdentificationPrompt(config: AnalysisConfig): string {
    const ageContext = this.getAgeContext(config.ageGroup);

    return `
You are an expert math tutor analyzing student work. Identify and classify mathematical problems in the given text.

CONTEXT:
- Student level: ${ageContext}
- Expected difficulty: ${config.ageGroup}

IDENTIFY:
1. Individual mathematical problems or exercises
2. Problem type (arithmetic, algebra, geometry, word problem, etc.)
3. Difficulty level appropriate for age group
4. Mathematical concepts involved

RESPOND IN THIS FORMAT for each problem found:
PROBLEM_[N]: [The complete problem statement]
TYPE_[N]: [arithmetic/algebra/geometry/word_problem/multi_step]
DIFFICULTY_[N]: [elementary/middle/high_school]
CONCEPTS_[N]: [List key mathematical concepts]
GRADE_LEVEL_[N]: [Estimated grade level 1-12]

If no clear problems are found, respond with: NO_PROBLEMS_IDENTIFIED
    `.trim();
  }

  /**
   * Parse problem identification response
   */
  private parseProblemIdentification(response: string): AcademicProblem[] {
    if (response.includes('NO_PROBLEMS_IDENTIFIED')) {
      return [];
    }

    const problems: AcademicProblem[] = [];
    let problemIndex = 1;

    while (true) {
      const problem = this.extractSection(response, `PROBLEM_${problemIndex}`);
      const type = this.extractSection(response, `TYPE_${problemIndex}`);
      const difficulty = this.extractSection(response, `DIFFICULTY_${problemIndex}`);
      const concepts = this.extractSection(response, `CONCEPTS_${problemIndex}`);
      const gradeLevel = this.extractSection(response, `GRADE_LEVEL_${problemIndex}`);

      if (!problem) break;

      problems.push({
        id: `problem_${problemIndex}`,
        subject: 'mathematics',
        contentType: 'mathematical_problem',
        type: (type as any) || 'arithmetic',
        difficulty: (difficulty as any) || 'elementary',
        problem: problem,
        concepts: concepts ? concepts.split(',').map(c => c.trim()) : [],
        gradeLevel: parseInt(gradeLevel || '1')
      });

      problemIndex++;
    }

    return problems;
  }

  /**
   * Analyze solutions for identified problems
   */
  private async analyzeSolutions(
    problems: AcademicProblem[],
    ocrResult: OCRResult,
    config: AnalysisConfig
  ): Promise<ContentAnalysis[]> {
    if (problems.length === 0) {
      return [];
    }

    const solutions: ContentAnalysis[] = [];

    for (const problem of problems) {
      try {
        const analysis = await this.analyzeSingleSolution(problem, ocrResult, config);
        solutions.push(analysis);
      } catch (error) {
        console.error(`Solution analysis failed for problem ${problem.id}:`, error);

        // Create empty analysis for failed cases
        solutions.push({
          problemId: problem.id,
          subject: problem.subject,
          studentWork: '',
          analysisType: 'solution',
          steps: [],
          isCorrect: false,
          accuracy: 0,
          approach: 'incomplete',
          completeness: 0,
          qualityMetrics: { clarity: 0, organization: 0, creativity: 0, criticalThinking: 0 }
        });
      }
    }

    return solutions;
  }

  /**
   * Analyze a single solution
   */
  private async analyzeSingleSolution(
    problem: AcademicProblem,
    ocrResult: OCRResult,
    config: AnalysisConfig
  ): Promise<ContentAnalysis> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: this.buildContentAnalysisPrompt(config)
        },
        {
          role: 'user',
          content: `
PROBLEM: ${problem.problem}
STUDENT_WORK: ${ocrResult.extractedText}

Please analyze the student's solution approach and accuracy.
          `.trim()
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });

    const analysisText = response.choices[0]?.message?.content || '';
    return this.parseContentAnalysis(problem.id, problem.subject, ocrResult.extractedText, analysisText);
  }

  /**
   * Build solution analysis prompt
   */
  private buildContentAnalysisPrompt(_config: AnalysisConfig): string {
    return `
You are an expert math tutor evaluating student solutions. Analyze the correctness, approach, and completeness of the student's work.

EVALUATE:
1. Correctness of the final answer
2. Validity of the solution approach
3. Accuracy of individual steps
4. Completeness of the solution
5. Mathematical reasoning quality

RESPOND IN THIS FORMAT:
STUDENT_SOLUTION: [What the student wrote/showed]
CORRECT: [true/false - is the answer correct?]
ACCURACY: [0-100 percentage of correctness]
APPROACH: [standard/creative/incomplete/incorrect]
COMPLETENESS: [0-100 percentage complete]
STEPS: [List each solution step with correctness]
REASONING: [Assessment of mathematical reasoning]

Be encouraging but accurate in your assessment.
    `.trim();
  }

  /**
   * Parse solution analysis response
   */
  private parseContentAnalysis(problemId: string, subject: SubjectType, studentWork: string, response: string): ContentAnalysis {
    const _studentSolution = this.extractSection(response, 'STUDENT_SOLUTION') || '';
    const correct = this.extractSection(response, 'CORRECT')?.toLowerCase() === 'true';
    const accuracy = Math.min(100, Math.max(0, parseInt(this.extractSection(response, 'ACCURACY') || '0'))) / 100;
    const approach = (this.extractSection(response, 'APPROACH') as any) || 'incomplete';
    const completeness = Math.min(100, Math.max(0, parseInt(this.extractSection(response, 'COMPLETENESS') || '0'))) / 100;

    // Simple step parsing
    const steps: AnalysisStep[] = [];
    const stepsText = this.extractSection(response, 'STEPS');
    if (stepsText) {
      const stepLines = stepsText.split('\n').filter(line => line.trim());
      stepLines.forEach((line, index) => {
        steps.push({
          stepNumber: index + 1,
          content: line.trim(),
          isCorrect: true, // Simplified for now
          operation: 'unknown',
          reasoning: 'Step analysis'
        });
      });
    }

    return {
      problemId,
      subject,
      studentWork,
      analysisType: subject === 'mathematics' ? 'solution' : 'essay',
      steps,
      isCorrect: correct,
      accuracy,
      approach,
      completeness,
      qualityMetrics: {
        clarity: accuracy,
        organization: completeness,
        creativity: accuracy,
        criticalThinking: completeness
      }
    };
  }

  /**
   * Assess skills demonstrated in the work
   */
  private async assessSkills(
    problems: AcademicProblem[],
    solutions: ContentAnalysis[],
    ageGroup: AgeGroup
  ): Promise<SkillAssessment> {
    // Analyze demonstrated skills
    const demonstratedSkills: string[] = [];
    const skillLevels: Record<string, number> = {};

    problems.forEach(problem => {
      problem.concepts.forEach(concept => {
        if (!demonstratedSkills.includes(concept)) {
          demonstratedSkills.push(concept);
        }
      });
    });

    // Calculate skill levels based on solution accuracy
    solutions.forEach(solution => {
      const problem = problems.find(p => p.id === solution.problemId);
      if (problem) {
        problem.concepts.forEach(concept => {
          skillLevels[concept] = (skillLevels[concept] || 0) + solution.accuracy;
        });
      }
    });

    // Normalize skill levels
    Object.keys(skillLevels).forEach(skill => {
      const relevantSolutions = solutions.filter(s => {
        const problem = problems.find(p => p.id === s.problemId);
        return problem?.concepts.includes(skill);
      });

      if (relevantSolutions.length > 0) {
        skillLevels[skill] = skillLevels[skill] / relevantSolutions.length;
      }
    });

    // Identify strengths and improvement areas
    const strengthAreas = Object.entries(skillLevels)
      .filter(([_, level]) => level >= 0.8)
      .map(([skill, _]) => skill);

    const improvementAreas = Object.entries(skillLevels)
      .filter(([_, level]) => level < 0.6)
      .map(([skill, _]) => skill);

    // Calculate grade equivalency
    const averageAccuracy = solutions.length > 0
      ? solutions.reduce((sum, s) => sum + s.accuracy, 0) / solutions.length
      : 0;

    const baseGrade = this.getBaseGradeForAge(ageGroup);
    const _gradeEquivalency = baseGrade + (averageAccuracy - 0.7) * 2;

    return {
      subjectSkills: {} as Record<SubjectType, SubjectSkills>,
      overallSkills: demonstratedSkills,
      crossCurricularSkills: [],
      skillLevels,
      strengthAreas,
      improvementAreas,
      gradeEquivalency: {} as Record<SubjectType, number>,
      readinessForAdvancement: averageAccuracy >= 0.85 && strengthAreas.length >= improvementAreas.length,
      overallAccuracy: averageAccuracy
    };
  }

  /**
   * Get base grade level for age group
   */
  private getBaseGradeForAge(ageGroup: AgeGroup): number {
    switch (ageGroup) {
      case 'ages6to9': return 2;
      case 'ages10to13': return 6;
      case 'ages14to16': return 9;
      default: return 5;
    }
  }

  /**
   * Analyze errors in solutions
   */
  private async analyzeErrors(
    solutions: ContentAnalysis[],
    _ageGroup: AgeGroup
  ): Promise<ErrorAnalysis> {
    const errorTypes: ErrorType[] = [];
    const misconceptions: string[] = [];
    const patterns: ErrorPattern[] = [];

    // Analyze each incorrect solution
    solutions.filter(s => !s.isCorrect || s.accuracy < 1.0).forEach(solution => {
      // Simple error categorization
      if (solution.accuracy > 0.7) {
        errorTypes.push({
          category: 'careless',
          description: 'Minor computational error',
          examples: [solution.studentWork],
          frequency: 1,
          impact: 'low',
          subject: 'general'
        });
      } else if (solution.approach === 'incorrect') {
        errorTypes.push({
          category: 'conceptual',
          description: 'Misunderstanding of concept',
          examples: [solution.studentWork],
          frequency: 1,
          impact: 'high',
          subject: 'general'
        });
      } else {
        errorTypes.push({
          category: 'procedural',
          description: 'Incorrect method or procedure',
          examples: [solution.studentWork],
          frequency: 1,
          impact: 'medium',
          subject: 'general'
        });
      }
    });

    // Determine overall severity
    const hasHighImpactErrors = errorTypes.some(e => e.impact === 'high');
    const hasMultipleErrors = errorTypes.length > 2;

    let severity: 'minor' | 'moderate' | 'significant';
    if (hasHighImpactErrors || hasMultipleErrors) {
      severity = 'significant';
    } else if (errorTypes.length > 0) {
      severity = 'moderate';
    } else {
      severity = 'minor';
    }

    // Generate remediation suggestions
    const remediation: RemediationSuggestion[] = [];
    if (errorTypes.length > 0) {
      remediation.push({
        skill: 'Review and practice',
        recommendation: 'Focus on careful checking and step-by-step problem solving',
        practiceActivities: ['Guided practice problems', 'Step-by-step examples'],
        estimatedTime: '15-20 minutes',
        priority: 'medium'
      });
    }

    return {
      errorTypes,
      misconceptions,
      patterns,
      severity,
      remediation
    };
  }

  /**
   * Generate educational feedback
   */
  private async generateFeedback(
    problems: AcademicProblem[],
    contentAnalysis: ContentAnalysis[],
    skillAssessment: SkillAssessment,
    errorAnalysis: ErrorAnalysis,
    config: AnalysisConfig
  ): Promise<EducationalFeedback> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: this.buildFeedbackPrompt(config)
          },
          {
            role: 'user',
            content: this.buildFeedbackContext(problems, contentAnalysis, skillAssessment, errorAnalysis)
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });

      const feedbackText = response.choices[0]?.message?.content || '';
      return this.parseFeedbackResponse(feedbackText, config.ageGroup);

    } catch (error) {
      console.error('Feedback generation failed:', error);
      return this.createDefaultFeedback(config.ageGroup);
    }
  }

  /**
   * Build feedback generation prompt
   */
  private buildFeedbackPrompt(config: AnalysisConfig): string {
    const ageContext = this.getAgeContext(config.ageGroup);
    const subjectContexts = this.getSubjectContexts(config.expectedSubjects);

    return `
You are a caring, knowledgeable educational tutor providing feedback to a student across multiple academic subjects. Your goal is to be encouraging while helping them improve in all areas of learning.

CONTEXT:
- Student level: ${ageContext}
- Age group: ${config.ageGroup}
- Subjects covered: ${config.expectedSubjects.join(', ')}
- Content types: ${config.contentTypes.join(', ')}
- Feedback style: ${config.feedbackDetailLevel}

SUBJECT EXPERTISE:
${subjectContexts}

PROVIDE MULTI-SUBJECT FEEDBACK:
1. Overall encouraging assessment across all subjects
2. Subject-specific feedback and insights
3. Cross-curricular connections and observations
4. Suggestions for improvement in each area
5. Questions to check understanding
6. Next steps for continued learning

TONE:
- Encouraging and supportive across all subjects
- Age-appropriate language
- Focus on learning and growth
- Celebrate successes, gently address areas for improvement
- Make connections between different subjects when relevant

RESPOND IN THIS FORMAT:
OVERALL: [General encouraging assessment across all work]
SUBJECT_FEEDBACK: [Break down by each subject detected]
CROSS_CURRICULAR: [Connections between subjects]
ENCOURAGEMENT: [Positive reinforcement]
NEXT_STEPS: [What to work on next in each subject]
QUESTIONS: [Questions to ask the student about their work]
SIMPLIFIED: [Age-appropriate version if needed]
    `.trim();
  }

  /**
   * Build feedback context from analysis results
   */
  private buildFeedbackContext(
    problems: AcademicProblem[],
    contentAnalysis: ContentAnalysis[],
    skillAssessment: SkillAssessment,
    errorAnalysis: ErrorAnalysis
  ): string {
    // Group problems and analysis by subject
    const subjectSummary = this.groupContentBySubject(problems, contentAnalysis);

    return `
ACADEMIC WORK ANALYZED:
Total Problems/Tasks: ${problems.length}
Content Analysis Items: ${contentAnalysis.length}

SUBJECT BREAKDOWN:
${Object.entries(subjectSummary).map(([subject, data]) =>
  `${subject.toUpperCase()}: ${data.problems} problems, ${data.accuracy}% average accuracy`
).join('\n')}

CONTENT ANALYSIS SUMMARY:
${contentAnalysis.map(c =>
  `- ${c.subject}: ${c.analysisType} - ${c.isCorrect !== undefined ? (c.isCorrect ? 'Correct' : 'Needs improvement') : 'Evaluated'} (${Math.round(c.accuracy * 100)}% quality)`
).join('\n')}

DEMONSTRATED SKILLS BY SUBJECT:
${Object.entries(skillAssessment.subjectSkills).map(([subject, skills]) =>
  `${subject}: ${skills.demonstratedSkills.join(', ') || 'None yet'}`
).join('\n')}

OVERALL STRENGTHS:
${skillAssessment.strengthAreas.join(', ') || 'Working to identify strengths'}

AREAS FOR GROWTH:
${skillAssessment.improvementAreas.join(', ') || 'All areas looking good'}

CROSS-CURRICULAR SKILLS:
${skillAssessment.crossCurricularSkills.join(', ') || 'Developing connections between subjects'}

ERROR ANALYSIS:
Severity: ${errorAnalysis.severity}
Error types by subject: ${errorAnalysis.errorTypes.map(e => `${e.subject}:${e.category}`).join(', ')}

Please provide encouraging, subject-specific feedback based on this multi-subject analysis.
    `.trim();
  }

  /**
   * Group content analysis by subject for summary
   */
  private groupContentBySubject(problems: AcademicProblem[], contentAnalysis: ContentAnalysis[]): Record<string, {problems: number, accuracy: number}> {
    const summary: Record<string, {problems: number, accuracy: number, totalAccuracy: number}> = {};

    // Count problems by subject
    problems.forEach(problem => {
      if (!summary[problem.subject]) {
        summary[problem.subject] = { problems: 0, accuracy: 0, totalAccuracy: 0 };
      }
      summary[problem.subject].problems++;
    });

    // Add accuracy from content analysis
    contentAnalysis.forEach(analysis => {
      if (!summary[analysis.subject]) {
        summary[analysis.subject] = { problems: 0, accuracy: 0, totalAccuracy: 0 };
      }
      summary[analysis.subject].totalAccuracy += analysis.accuracy;
    });

    // Calculate average accuracy
    Object.keys(summary).forEach(subject => {
      const count = contentAnalysis.filter(c => c.subject === subject).length;
      summary[subject].accuracy = count > 0 ? Math.round((summary[subject].totalAccuracy / count) * 100) : 0;
    });

    return Object.fromEntries(
      Object.entries(summary).map(([subject, data]) => [
        subject,
        { problems: data.problems, accuracy: data.accuracy }
      ])
    );
  }

  /**
   * Parse feedback response
   */
  private parseFeedbackResponse(response: string, ageGroup: AgeGroup): EducationalFeedback {
    const overallAssessment = this.extractSection(response, 'OVERALL') || 'Great work on your academic work!';
    const subjectFeedbackText = this.extractSection(response, 'SUBJECT_FEEDBACK') || '';
    const crossCurricularText = this.extractSection(response, 'CROSS_CURRICULAR') || '';
    const encouragement = this.extractSection(response, 'ENCOURAGEMENT') || 'Keep up the excellent learning!';
    const nextStepsText = this.extractSection(response, 'NEXT_STEPS') || '';
    const questionsText = this.extractSection(response, 'QUESTIONS') || '';
    const simplified = this.extractSection(response, 'SIMPLIFIED') || overallAssessment;

    // Parse subject-specific feedback
    const defaultSubjectFeedback: SubjectFeedback = {
      subject: 'general',
      assessment: 'Good work shown',
      specificFeedback: [],
      skillHighlights: [],
      improvementAreas: [],
      nextLearningGoals: []
    };

    const subjectFeedback: Record<SubjectType, SubjectFeedback> = {
      mathematics: { ...defaultSubjectFeedback, subject: 'mathematics' },
      english: { ...defaultSubjectFeedback, subject: 'english' },
      science: { ...defaultSubjectFeedback, subject: 'science' },
      history: { ...defaultSubjectFeedback, subject: 'history' },
      geography: { ...defaultSubjectFeedback, subject: 'geography' },
      art: { ...defaultSubjectFeedback, subject: 'art' },
      general: { ...defaultSubjectFeedback, subject: 'general' }
    };

    if (subjectFeedbackText) {
      this.parseSubjectFeedback(subjectFeedbackText, subjectFeedback);
    }

    // Parse cross-curricular insights
    const crossCurricularInsights = crossCurricularText
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.trim());

    // Parse next steps
    const nextSteps = nextStepsText.split('\n').filter(line => line.trim()).map(line => line.trim());

    // Parse questions
    const questionsForStudent = questionsText.split('\n').filter(line => line.trim()).map(line => line.trim());

    return {
      overallAssessment,
      subjectFeedback,
      crossCurricularInsights,
      encouragement,
      nextSteps,
      questionsForStudent,
      ageAdaptivePresentation: {
        ageGroup,
        simplifiedLanguage: simplified,
        visualCues: this.getSubjectVisualCues(),
        interactionStyle: this.getInteractionStyle(ageGroup),
        complexityLevel: this.getComplexityLevel(ageGroup)
      }
    };
  }

  /**
   * Parse subject-specific feedback from response text
   */
  private parseSubjectFeedback(feedbackText: string, subjectFeedback: Record<SubjectType, SubjectFeedback>): void {
    const subjects: SubjectType[] = ['mathematics', 'english', 'science', 'history', 'geography', 'art', 'general'];

    subjects.forEach(subject => {
      const subjectPattern = new RegExp(`${subject}[:\\s]+([^\\n]+(?:\\n(?!\\w+:)[^\\n]+)*)`, 'gi');
      const match = feedbackText.match(subjectPattern);

      if (match) {
        const content = match[0].replace(new RegExp(`^${subject}[:\\s]+`, 'i'), '').trim();
        const lines = content.split('\n').filter(line => line.trim());

        subjectFeedback[subject] = {
          subject,
          assessment: lines[0] || `Good work in ${subject}`,
          specificFeedback: lines.slice(1).map(line => ({
            type: 'suggestion' as const,
            subject,
            content: line.trim(),
            importance: 'medium' as const
          })),
          skillHighlights: [],
          improvementAreas: [],
          nextLearningGoals: []
        };
      }
    });
  }

  /**
   * Get subject-appropriate visual cues
   */
  private getSubjectVisualCues(): string[] {
    return ['📚', '✍️', '🔬', '📜', '🌍', '🎨', '💡', '✅', '🎯'];
  }

  /**
   * Get interaction style for age group
   */
  private getInteractionStyle(ageGroup: AgeGroup): 'encouraging' | 'detailed' | 'analytical' {
    switch (ageGroup) {
      case 'ages6to9': return 'encouraging';
      case 'ages10to13': return 'detailed';
      case 'ages14to16': return 'analytical';
      default: return 'encouraging';
    }
  }

  /**
   * Get complexity level for age group
   */
  private getComplexityLevel(ageGroup: AgeGroup): number {
    switch (ageGroup) {
      case 'ages6to9': return 1;
      case 'ages10to13': return 3;
      case 'ages14to16': return 5;
      default: return 2;
    }
  }

  /**
   * Build analysis configuration
   */
  private buildAnalysisConfig(ageGroup: AgeGroup, config?: Partial<AnalysisConfig>): AnalysisConfig {
    const defaults: AnalysisConfig = {
      ageGroup,
      expectedSubjects: ['mathematics'],
      contentTypes: ['mathematical_problem'],
      difficultySensitivity: 0.7,
      feedbackDetailLevel: 'detailed',
      focusAreas: ['problem solving', 'computational accuracy'],
      subjectSpecificSettings: {
        mathematics: { enabled: true, analysisDepth: 'moderate', feedbackStyle: 'encouraging', specificCriteria: [] },
        english: { enabled: false, analysisDepth: 'surface', feedbackStyle: 'encouraging', specificCriteria: [] },
        science: { enabled: false, analysisDepth: 'surface', feedbackStyle: 'encouraging', specificCriteria: [] },
        history: { enabled: false, analysisDepth: 'surface', feedbackStyle: 'encouraging', specificCriteria: [] },
        geography: { enabled: false, analysisDepth: 'surface', feedbackStyle: 'encouraging', specificCriteria: [] },
        art: { enabled: false, analysisDepth: 'surface', feedbackStyle: 'encouraging', specificCriteria: [] },
        general: { enabled: true, analysisDepth: 'surface', feedbackStyle: 'encouraging', specificCriteria: [] }
      },
      timeoutSeconds: 30
    };

    return { ...defaults, ...config };
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(ocrResult: OCRResult, solutions: ContentAnalysis[]): number {
    if (solutions.length === 0) {
      return ocrResult.confidence * 0.5; // Low confidence if no solutions found
    }

    const averageAccuracy = solutions.reduce((sum, s) => sum + s.accuracy, 0) / solutions.length;
    return (ocrResult.confidence + averageAccuracy) / 2;
  }

  /**
   * Create empty results for error cases
   */
  private createEmptyOCRResult(): OCRResult {
    return {
      extractedText: '',
      confidence: 0,
      regions: [],
      academicContent: [],
      detectedSubjects: [],
      primaryContentType: 'general_notes',
      processingTime: 0
    };
  }

  private createEmptySkillAssessment(): SkillAssessment {
    return {
      subjectSkills: {} as Record<SubjectType, SubjectSkills>,
      overallSkills: [],
      crossCurricularSkills: [],
      skillLevels: {},
      strengthAreas: [],
      improvementAreas: [],
      gradeEquivalency: {} as Record<SubjectType, number>,
      readinessForAdvancement: false,
      overallAccuracy: 0
    };
  }

  private createEmptyErrorAnalysis(): ErrorAnalysis {
    return {
      errorTypes: [],
      misconceptions: [],
      patterns: [],
      severity: 'minor',
      remediation: []
    };
  }

  private createErrorFeedback(ageGroup: AgeGroup, _error: any): EducationalFeedback {
    return {
      overallAssessment: 'I had trouble reading your work clearly.',
      subjectFeedback: {
        mathematics: { subject: 'mathematics', assessment: 'Unable to analyze', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        english: { subject: 'english', assessment: 'Unable to analyze', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        science: { subject: 'science', assessment: 'Unable to analyze', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        history: { subject: 'history', assessment: 'Unable to analyze', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        geography: { subject: 'geography', assessment: 'Unable to analyze', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        art: { subject: 'art', assessment: 'Unable to analyze', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        general: { subject: 'general', assessment: 'Unable to analyze', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] }
      },
      crossCurricularInsights: [],
      encouragement: 'Don\'t worry! Let\'s try again with a better photo.',
      nextSteps: ['Take a new photo with better lighting', 'Make sure the work is clearly visible'],
      questionsForStudent: ['Can you try taking another photo?'],
      ageAdaptivePresentation: {
        ageGroup,
        simplifiedLanguage: 'I need a clearer picture to help you better!',
        visualCues: ['📸', '💡'],
        interactionStyle: 'encouraging',
        complexityLevel: 1
      }
    };
  }

  private createDefaultFeedback(ageGroup: AgeGroup): EducationalFeedback {
    return {
      overallAssessment: 'Thanks for sharing your academic work with me!',
      subjectFeedback: {
        mathematics: { subject: 'mathematics', assessment: 'Thanks for sharing your work!', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        english: { subject: 'english', assessment: 'Thanks for sharing your work!', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        science: { subject: 'science', assessment: 'Thanks for sharing your work!', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        history: { subject: 'history', assessment: 'Thanks for sharing your work!', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        geography: { subject: 'geography', assessment: 'Thanks for sharing your work!', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        art: { subject: 'art', assessment: 'Thanks for sharing your work!', specificFeedback: [], skillHighlights: [], improvementAreas: [], nextLearningGoals: [] },
        general: {
          subject: 'general',
          assessment: 'I can see you\'re working hard on your studies.',
          specificFeedback: [{
            type: 'praise',
            subject: 'general',
            content: 'Your effort shows in your work.',
            importance: 'medium'
          }],
          skillHighlights: ['Dedication', 'Effort'],
          improvementAreas: [],
          nextLearningGoals: ['Continue building on your foundation']
        }
      },
      crossCurricularInsights: ['Learning is a journey that connects all subjects together'],
      encouragement: 'Keep practicing and you\'ll keep getting better!',
      nextSteps: ['Continue practicing across all subject areas'],
      questionsForStudent: ['What subject are you most excited to learn about?'],
      ageAdaptivePresentation: {
        ageGroup,
        simplifiedLanguage: 'Great job working on your studies! Keep it up!',
        visualCues: this.getSubjectVisualCues(),
        interactionStyle: this.getInteractionStyle(ageGroup),
        complexityLevel: this.getComplexityLevel(ageGroup)
      }
    };
  }
}

/**
 * Factory function to create WorkAnalysisService instance
 */
export function createWorkAnalysisService(): WorkAnalysisService {
  return new WorkAnalysisService();
}

// Export service instance
export const workAnalysisService = new WorkAnalysisService();