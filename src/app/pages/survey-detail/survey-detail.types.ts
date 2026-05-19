/**
 * Describes one survey question with its answer options.
 */
export type QuestionBlock = {
  /**
   * Question text shown to the user.
   */
  text: string;

  /**
   * Defines whether the user can select multiple answers.
   */
  allowMultiple: boolean;

  /**
   * List of answer options for the question.
   */
  answers: string[];
};

/**
 * Normalized survey model used by the survey detail page.
 */
export type Survey = {
  /**
   * Unique survey id.
   */
  id: string;

  /**
   * Survey title shown on the card and detail page.
   */
  title: string;

  /**
   * Survey description text.
   */
  description: string;

  /**
   * Survey end date as a string.
   */
  endDate: string;

  /**
   * Survey category.
   */
  category: string;

  /**
   * List of questions that belong to the survey.
   */
  questions: QuestionBlock[];
};

/**
 * Minimal vote row used for loading and saving survey answers.
 */
export type VoteRow = {
  /**
   * Index of the question that was answered.
   */
  question_index: number;

  /**
   * Index of the selected answer.
   */
  answer_index: number;
};

/**
 * Raw survey row returned by Supabase.
 */
export type SurveyRow = {
  /**
   * Survey id returned by the database.
   */
  id: string | number;

  /**
   * Survey title returned by the database.
   */
  title: string;

  /**
   * Survey description returned by the database.
   */
  description: string;

  /**
   * Survey end date returned by the database.
   */
  end_date: string;

  /**
   * Survey category returned by the database.
   */
  category: string;

  /**
   * Questions returned by the database.
   *
   * Can already be parsed, stored as a JSON string, or be null.
   */
  questions: QuestionBlock[] | string | null;
};