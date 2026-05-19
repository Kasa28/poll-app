import { PublishedSurvey, QuestionBlock } from './create-survey.types';
/**
 * Returns the default placeholder text for a question by its index.
 *
 * @param questionIndex Index of the question.
 * @returns Placeholder text for the question.
 */
export function getQuestionPlaceholder(questionIndex: number) {
  if (questionIndex === 0) return 'Which date would work best for you?';
  if (questionIndex === 1) return 'Choose the activities you prefer?';
  return '';
}

/**
 * Returns helper text that explains whether one or multiple answers are allowed.
 *
 * @param question Question block used to check the selection mode.
 * @returns User-facing selection hint.
 */
export function getSelectionHint(question: QuestionBlock) {
  return question.allowMultiple
    ? 'More than one answer is possible.'
    : 'Only one answer can be selected.';
}

/**
 * Creates a new question block with default values.
 *
 * @param questionIndex Index used to choose the placeholder text.
 * @returns A new editable question block.
 */
export function buildQuestion(questionIndex: number): QuestionBlock {
  return {
    text: getQuestionPlaceholder(questionIndex),
    allowMultiple: false,
    answers: ['', ''],
  };
}

/**
 * Checks whether the survey form contains all required values.
 *
 * @param surveyTitle Current survey title.
 * @param surveyEndDate Current survey end date.
 * @param selectedCategory Selected survey category.
 * @param questions Current question blocks.
 * @returns True if the survey form is valid.
 */
export function isSurveyFormValid(
  surveyTitle: string,
  surveyEndDate: string,
  selectedCategory: string,
  questions: QuestionBlock[]
) {
  if (!surveyTitle.trim() || !surveyEndDate || !selectedCategory) return false;
  return questions.every(
    question =>
      question.text.trim() &&
      question.answers.length >= 2 &&
      question.answers.every(answer => answer.trim())
  );
}

/**
 * Trims all question and answer values and fills missing values with fallback text.
 *
 * @param questions Question blocks to normalize.
 * @returns Normalized question blocks.
 */
export function normalizeQuestions(questions: QuestionBlock[]) {
  return questions.map(question => ({
    text: question.text.trim() || 'Untitled question',
    allowMultiple: question.allowMultiple,
    answers: question.answers.map(answer => answer.trim() || 'Untitled answer'),
  }));
}

/**
 * Builds the final survey object for local storage and Supabase publishing.
 *
 * @param surveyTitle Current survey title.
 * @param surveyDescription Current survey description.
 * @param surveyEndDate Current survey end date.
 * @param selectedCategory Selected survey category.
 * @param questions Current question blocks.
 * @returns A complete published survey payload.
 */
export function buildSurvey(
  surveyTitle: string,
  surveyDescription: string,
  surveyEndDate: string,
  selectedCategory: string,
  questions: QuestionBlock[]
): PublishedSurvey {
  return {
    id: crypto.randomUUID(),
    title: surveyTitle.trim(),
    description: surveyDescription.trim(),
    endDate: surveyEndDate,
    category: selectedCategory,
    questions: normalizeQuestions(questions),
  };
}

/**
 * Reads the locally stored published surveys.
 *
 * @returns Saved surveys from localStorage.
 */
export function getSavedSurveys(): PublishedSurvey[] {
  return JSON.parse(localStorage.getItem('publishedSurveys') || '[]');
}

/**
 * Saves a published survey in localStorage as fallback data.
 *
 * @param survey Survey payload to save.
 */
export function saveSurveyLocally(survey: PublishedSurvey) {
  const savedSurveys = getSavedSurveys();
  savedSurveys.unshift(survey);
  localStorage.setItem('publishedSurveys', JSON.stringify(savedSurveys));
  localStorage.setItem('publishedSurvey', JSON.stringify(survey));
}

/**
 * Replaces a temporary local survey id with the id returned by Supabase.
 *
 * @param oldId Temporary local survey id.
 * @param newId Persisted Supabase survey id.
 */
export function replaceLocalSurveyId(oldId: string, newId: string) {
  const updatedSurveys = getSavedSurveys().map(survey =>
    survey.id === oldId ? { ...survey, id: newId } : survey
  );
  localStorage.setItem('publishedSurveys', JSON.stringify(updatedSurveys));
  const updatedSurvey = updatedSurveys.find(survey => survey.id === newId);
  if (updatedSurvey) {
    localStorage.setItem('publishedSurvey', JSON.stringify(updatedSurvey));
  }
}

/**
 * Converts the local survey model into the field names expected by Supabase.
 *
 * @param survey Survey payload to convert.
 * @returns Supabase insert payload.
 */
export function getInsertPayload(survey: PublishedSurvey) {
  return {
    title: survey.title,
    description: survey.description,
    end_date: survey.endDate,
    category: survey.category,
    questions: survey.questions,
  };
}