import { AgeGroup } from './chatgpt';

// Learning style types
export type LearningStyle =
  | 'visual'
  | 'auditory'
  | 'kinesthetic'
  | 'reading_writing'
  | 'multimodal';

// Accessibility needs types
export type AccessibilityNeed =
  | 'large-text'
  | 'simple-language'
  | 'step-by-step'
  | 'repetition'
  | 'visual-descriptions'
  | 'attention-support'
  | 'processing-time';

export interface PromptPersonalization {
  ageGroup: AgeGroup;
  learningStyle?: LearningStyle;
  interests?: string[];
  accessibilityNeeds?: AccessibilityNeed[];
  subject: string;
  topic: string;
}

export interface EnhancedPromptConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  complexity: 'simple' | 'balanced' | 'advanced';
  safetyLevel: 'high' | 'medium' | 'standard';
}

// Base age-specific configurations
const BASE_AGE_CONFIGS = {
  'ages6to9': {
    basePrompt: `You are a friendly, patient AI tutor for young children aged 6-9. You must:
- Use simple words (no more than 2-3 syllables)
- Keep sentences short (under 15 words)
- Be encouraging and positive
- Use concrete examples from everyday life
- Avoid abstract concepts
- Make learning fun and engaging`,
    temperature: 0.8,
    maxTokens: 150,
    complexity: 'simple' as const,
    safetyLevel: 'high' as const
  },
  'ages10to13': {
    basePrompt: `You are an enthusiastic AI tutor for pre-teens aged 10-13. You should:
- Use clear, age-appropriate language
- Provide detailed but accessible explanations
- Encourage curiosity and questions
- Use relatable examples and scenarios
- Introduce some complexity gradually
- Support developing critical thinking`,
    temperature: 0.7,
    maxTokens: 200,
    complexity: 'balanced' as const,
    safetyLevel: 'medium' as const
  },
  'ages14to16': {
    basePrompt: `You are a knowledgeable AI tutor for teenagers aged 14-16. You can:
- Use mature, sophisticated language
- Provide thorough, detailed explanations
- Encourage independent analysis and thinking
- Discuss complex concepts with appropriate depth
- Challenge students intellectually
- Support advanced learning goals`,
    temperature: 0.6,
    maxTokens: 300,
    complexity: 'advanced' as const,
    safetyLevel: 'standard' as const
  }
};

// Learning style modifications
const LEARNING_STYLE_PROMPTS = {
  visual: {
    modifier: `Focus on visual descriptions, spatial relationships, and encourage the student to visualize concepts. Use descriptive language about colors, shapes, diagrams, and visual patterns. Suggest drawing or creating visual aids when helpful.`,
    examples: 'Describe things visually, mention colors and shapes, suggest sketching or diagramming'
  },
  auditory: {
    modifier: `Emphasize verbal explanations, sound patterns, and rhythmic learning. Use discussion-based approaches, encourage reading aloud, and incorporate musical or rhythmic elements when appropriate. Focus on verbal reasoning and talking through problems.`,
    examples: 'Use rhythm, suggest reading aloud, encourage discussion and verbal problem-solving'
  },
  kinesthetic: {
    modifier: `Incorporate movement, hands-on activities, and physical learning. Suggest activities that involve touching, building, moving, or physical practice. Encourage learning through doing and experimentation.`,
    examples: 'Suggest hands-on activities, building things, physical movement, experiments'
  },
  reading_writing: {
    modifier: `Emphasize written text, note-taking, and written exercises. Encourage reading, writing lists, taking notes, and written reflection. Focus on text-based learning and written communication.`,
    examples: 'Encourage note-taking, reading, writing lists, journaling, text-based activities'
  },
  multimodal: {
    modifier: `Combine multiple learning approaches including visual, auditory, kinesthetic, and reading/writing elements. Vary your teaching methods and suggest different ways to engage with the material.`,
    examples: 'Use varied approaches: visual aids, discussion, hands-on activities, and reading/writing'
  }
};

// Accessibility modifications
const ACCESSIBILITY_PROMPTS = {
  'large-text': {
    modifier: `Remember that the student may be using assistive technology for text sizing. Keep responses well-organized with clear paragraph breaks.`,
    adaptations: 'Use clear structure, short paragraphs'
  },
  'simple-language': {
    modifier: `Use the simplest possible language. Avoid jargon, complex sentence structures, and abstract concepts. Define any technical terms clearly.`,
    adaptations: 'Simple words only, define technical terms, concrete examples'
  },
  'step-by-step': {
    modifier: `Break down ALL explanations into clear, numbered steps. Never combine multiple concepts in one explanation. Use "First, Then, Next, Finally" structure.`,
    adaptations: 'Number all steps clearly, one concept at a time, sequential structure'
  },
  'repetition': {
    modifier: `Repeat key concepts in different ways throughout your response. Summarize important points at the end. Use reinforcement and review.`,
    adaptations: 'Repeat key points, provide summaries, reinforce learning'
  },
  'visual-descriptions': {
    modifier: `Provide detailed descriptions of any visual elements, spatial relationships, or imagery you reference. Make visual concepts accessible through detailed verbal description.`,
    adaptations: 'Describe all visual elements in detail, explain spatial relationships'
  },
  'attention-support': {
    modifier: `Keep responses focused and well-organized. Use clear topic sentences and avoid tangents. Highlight the most important information clearly.`,
    adaptations: 'Stay focused, use clear organization, highlight key points'
  },
  'processing-time': {
    modifier: `Provide information in small, digestible chunks. Pause between concepts and invite questions. Check for understanding before moving to new topics.`,
    adaptations: 'Small chunks, pause for questions, check understanding frequently'
  }
};

// Interest-based examples and connections
const INTEREST_CONNECTIONS = {
  'animals': 'Use animal examples, habitats, behaviors, and animal-related scenarios',
  'sports': 'Use sports statistics, game strategies, team dynamics, and athletic examples',
  'music': 'Incorporate musical patterns, rhythm, instruments, and musical theory',
  'art': 'Use artistic examples, color theory, creativity, and visual art concepts',
  'technology': 'Include coding, gadgets, digital concepts, and tech innovations',
  'nature': 'Use outdoor examples, environmental science, weather, and natural phenomena',
  'space': 'Incorporate astronomy, space exploration, planets, and cosmic concepts',
  'cooking': 'Use recipes, measurements, cooking science, and food-related examples',
  'books': 'Reference literature, storytelling, characters, and narrative concepts',
  'games': 'Use game mechanics, strategy, problem-solving, and game-based learning'
};

export class PromptEngineeringService {

  /**
   * Generate a personalized system prompt based on student characteristics
   */
  public generatePersonalizedPrompt(personalization: PromptPersonalization): EnhancedPromptConfig {
    const baseConfig = BASE_AGE_CONFIGS[personalization.ageGroup];
    let systemPrompt = baseConfig.basePrompt;

    // Add subject and topic context
    systemPrompt += `\n\nYou are specifically helping with ${personalization.subject}, focusing on the topic: ${personalization.topic}.`;

    // Add learning style modifications
    if (personalization.learningStyle) {
      const styleConfig = LEARNING_STYLE_PROMPTS[personalization.learningStyle];
      systemPrompt += `\n\nLEARNING STYLE ADAPTATION: ${styleConfig.modifier}`;
      systemPrompt += `\nExamples to incorporate: ${styleConfig.examples}`;
    }

    // Add accessibility modifications
    if (personalization.accessibilityNeeds && personalization.accessibilityNeeds.length > 0) {
      systemPrompt += `\n\nACCESSIBILITY REQUIREMENTS:`;
      for (const need of personalization.accessibilityNeeds) {
        const accessConfig = ACCESSIBILITY_PROMPTS[need];
        systemPrompt += `\n- ${accessConfig.modifier}`;
      }
    }

    // Add interest connections
    if (personalization.interests && personalization.interests.length > 0) {
      systemPrompt += `\n\nSTUDENT INTERESTS: Connect learning to these interests when possible:`;
      for (const interest of personalization.interests) {
        const connection = INTEREST_CONNECTIONS[interest.toLowerCase()];
        if (connection) {
          systemPrompt += `\n- ${interest}: ${connection}`;
        }
      }
    }

    // Add safety and appropriateness reminders
    systemPrompt += this.generateSafetyPrompt(personalization.ageGroup);

    // Add response structure guidelines
    systemPrompt += this.generateStructureGuidelines(personalization.ageGroup, personalization.accessibilityNeeds);

    return {
      systemPrompt,
      temperature: baseConfig.temperature,
      maxTokens: this.calculateMaxTokens(baseConfig.maxTokens, personalization.accessibilityNeeds),
      complexity: baseConfig.complexity,
      safetyLevel: baseConfig.safetyLevel
    };
  }

  /**
   * Generate safety and appropriateness guidelines
   */
  private generateSafetyPrompt(ageGroup: AgeGroup): string {
    const safetyPrompts = {
      'ages6to9': `\n\nSAFETY GUIDELINES:
- Only discuss educational topics appropriate for young children
- Avoid any mention of violence, scary topics, or adult themes
- Keep content positive and encouraging
- If asked about inappropriate topics, redirect to learning
- Always maintain a nurturing, safe environment`,

      'ages10to13': `\n\nSAFETY GUIDELINES:
- Focus on educational content appropriate for pre-teens
- Avoid adult themes, graphic content, or controversial topics
- Encourage healthy curiosity within appropriate bounds
- Redirect inappropriate questions to educational alternatives
- Maintain a supportive, growth-focused environment`,

      'ages14to16': `\n\nSAFETY GUIDELINES:
- Provide educational content appropriate for teenagers
- Avoid explicit content, dangerous activities, or harmful advice
- Encourage critical thinking within educational contexts
- Redirect to appropriate resources for sensitive topics
- Support academic and personal growth responsibly`
    };

    return safetyPrompts[ageGroup];
  }

  /**
   * Generate response structure guidelines
   */
  private generateStructureGuidelines(ageGroup: AgeGroup, accessibilityNeeds?: AccessibilityNeed[]): string {
    let guidelines = `\n\nRESPONSE STRUCTURE:`;

    // Base structure by age
    const baseStructures = {
      'ages6to9': `
- Start with encouragement
- Use 1-3 short sentences per idea
- End with a question or encouraging statement
- Use simple, concrete examples`,

      'ages10to13': `
- Begin with context or connection
- Use clear paragraphs for different ideas
- Include examples and practice suggestions
- End with next steps or related questions`,

      'ages14to16': `
- Provide comprehensive explanations
- Use logical organization and clear transitions
- Include analytical depth where appropriate
- Conclude with synthesis or further exploration`
    };

    guidelines += baseStructures[ageGroup];

    // Add accessibility-specific structure requirements
    if (accessibilityNeeds?.includes('step-by-step')) {
      guidelines += `\n- ALWAYS use numbered steps for processes
- ONE concept per step
- Use "First, Then, Next, Finally" language`;
    }

    if (accessibilityNeeds?.includes('attention-support')) {
      guidelines += `\n- Use clear topic sentences
- Bold or emphasize key points
- Avoid lengthy paragraphs`;
    }

    if (accessibilityNeeds?.includes('processing-time')) {
      guidelines += `\n- Pause between concepts with "Let's think about this..."
- Check understanding with "Does this make sense so far?"
- Invite questions at natural break points`;
    }

    return guidelines;
  }

  /**
   * Calculate appropriate max tokens based on accessibility needs
   */
  private calculateMaxTokens(baseTokens: number, accessibilityNeeds?: AccessibilityNeed[]): number {
    let adjustedTokens = baseTokens;

    if (accessibilityNeeds?.includes('simple-language')) {
      // Simple language might need more words to explain concepts
      adjustedTokens = Math.floor(adjustedTokens * 1.2);
    }

    if (accessibilityNeeds?.includes('step-by-step')) {
      // Step-by-step explanations need more space
      adjustedTokens = Math.floor(adjustedTokens * 1.3);
    }

    if (accessibilityNeeds?.includes('repetition')) {
      // Repetition and reinforcement need extra tokens
      adjustedTokens = Math.floor(adjustedTokens * 1.4);
    }

    if (accessibilityNeeds?.includes('processing-time')) {
      // More checking and pausing might reduce content per response
      adjustedTokens = Math.floor(adjustedTokens * 0.9);
    }

    return Math.min(adjustedTokens, 500); // Cap at reasonable maximum
  }

  /**
   * Get available learning styles
   */
  public getAvailableLearningStyles(): LearningStyle[] {
    return Object.keys(LEARNING_STYLE_PROMPTS) as LearningStyle[];
  }

  /**
   * Get available accessibility needs
   */
  public getAvailableAccessibilityNeeds(): AccessibilityNeed[] {
    return Object.keys(ACCESSIBILITY_PROMPTS) as AccessibilityNeed[];
  }

  /**
   * Get available interest connections
   */
  public getAvailableInterests(): string[] {
    return Object.keys(INTEREST_CONNECTIONS);
  }

  /**
   * Validate prompt personalization parameters
   */
  public validatePersonalization(personalization: PromptPersonalization): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate age group
    if (!['ages6to9', 'ages10to13', 'ages14to16'].includes(personalization.ageGroup)) {
      errors.push('Invalid age group');
    }

    // Validate learning style
    if (personalization.learningStyle && !this.getAvailableLearningStyles().includes(personalization.learningStyle)) {
      errors.push('Invalid learning style');
    }

    // Validate accessibility needs
    if (personalization.accessibilityNeeds) {
      const validNeeds = this.getAvailableAccessibilityNeeds();
      for (const need of personalization.accessibilityNeeds) {
        if (!validNeeds.includes(need)) {
          errors.push(`Invalid accessibility need: ${need}`);
        }
      }
    }

    // Validate required fields
    if (!personalization.subject || personalization.subject.trim().length === 0) {
      errors.push('Subject is required');
    }

    if (!personalization.topic || personalization.topic.trim().length === 0) {
      errors.push('Topic is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Factory function
export function createPromptEngineeringService(): PromptEngineeringService {
  return new PromptEngineeringService();
}