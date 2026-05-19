/**
 * Describes one editable question block inside a survey.
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
   * List of available answer options for the question.
   */
  answers: string[];
};

/**
 * Represents a complete survey that can be saved locally
 * and published to the database.
 */
export type PublishedSurvey = {
  /**
   * Unique survey id.
   */
  id: string;

  /**
   * Survey title shown on the survey card and detail page.
   */
  title: string;

  /**
   * Optional survey description text.
   */
  description: string;

  /**
   * Survey end date as a string.
   */
  endDate: string;

  /**
   * Selected survey category.
   */
  category: string;

  /**
   * List of questions that belong to the survey.
   */
  questions: QuestionBlock[];
};