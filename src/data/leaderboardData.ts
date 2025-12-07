export interface LeaderboardRow {
  model: string;  // Display name (from experiment_tracker)
  actualModel?: string;  // Actual model name from generated_questions.model (optional)
  subject: string;
  questionType: string;
  difficulty: string;
  questionsAboveThreshold: number;
  totalQuestions: number;
  percentage: number;
}

export const leaderboardData: LeaderboardRow[] = [
  // Math - Easy
  {
    model: 'Deepseek-v3-2-vanilla-rag',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Easy',
    questionsAboveThreshold: 52,
    totalQuestions: 56,
    percentage: 92.9
  },
  {
    model: 'gpt-oss-120b-vanilla-rag-harmony',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Easy',
    questionsAboveThreshold: 46,
    totalQuestions: 49,
    percentage: 93.9
  },
  {
    model: 'gpt-oss-120b-ft-rag-harmony',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Easy',
    questionsAboveThreshold: 310,
    totalQuestions: 335,
    percentage: 92.5
  },
  {
    model: 'gpt-oss-120b-vanilla-rag',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Easy',
    questionsAboveThreshold: 599,
    totalQuestions: 645,
    percentage: 94.5
  },
  {
    model: 'incept',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Easy',
    questionsAboveThreshold: 625,
    totalQuestions: 643,
    percentage: 97.2
  },
  
  // Math - Medium
  {
    model: 'Deepseek-v3-2-vanilla-rag',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Medium',
    questionsAboveThreshold: 51,
    totalQuestions: 56,
    percentage: 91.1
  },
  {
    model: 'gpt-oss-120b-vanilla-rag-harmony',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Medium',
    questionsAboveThreshold: 46,
    totalQuestions: 52,
    percentage: 88.5
  },
  {
    model: 'gpt-oss-120b-ft-rag-harmony',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Medium',
    questionsAboveThreshold: 300,
    totalQuestions: 336,
    percentage: 89.3
  },
  {
    model: 'gpt-oss-120b-vanilla-rag',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Medium',
    questionsAboveThreshold: 599,
    totalQuestions: 645,
    percentage: 92.9
  },
  {
    model: 'incept',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Medium',
    questionsAboveThreshold: 610,
    totalQuestions: 640,
    percentage: 95.31
  },
  
  // Math - Hard
  {
    model: 'Deepseek-v3-2-vanilla-rag',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Hard',
    questionsAboveThreshold: 50,
    totalQuestions: 55,
    percentage: 90.9
  },
  {
    model: 'gpt-oss-120b-vanilla-rag-harmony',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Hard',
    questionsAboveThreshold: 41,
    totalQuestions: 51,
    percentage: 80.4
  },
  {
    model: 'gpt-oss-120b-ft-rag-harmony',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Hard',
    questionsAboveThreshold: 290,
    totalQuestions: 330,
    percentage: 87.9
  },
  {
    model: 'gpt-oss-120b-vanilla-rag',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Hard',
    questionsAboveThreshold: 593,
    totalQuestions: 641,
    percentage: 92.5
  },
  {
    model: 'incept',
    subject: 'Math',
    questionType: 'MCQ',
    difficulty: 'Hard',
    questionsAboveThreshold: 577,
    totalQuestions: 637,
    percentage: 90.58
  }
];

