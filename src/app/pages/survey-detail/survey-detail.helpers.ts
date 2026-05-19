import { QuestionBlock, Survey, SurveyRow, VoteRow } from './survey-detail.types';

/**
 * Checks whether a survey end date is already in the past.
 *
 * @param endDate Optional survey end date.
 * @returns True if the survey has ended.
 */
export function isPastSurvey(endDate?: string) {
  if (!endDate) return false;
  return new Date(endDate).getTime() < Date.now();
}

/**
 * Returns helper text for single- or multi-select questions.
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
 * Converts an answer index into a plain answer letter.
 *
 * @param answerIndex Index of the answer.
 * @returns Answer letter like A or B.
 */
export function getAnswerLetter(answerIndex: number) {
  return String.fromCharCode(65 + answerIndex);
}

/**
 * Converts an answer index into a visible answer label.
 *
 * @param answerIndex Index of the answer.
 * @returns Answer label like A. or B.
 */
export function getAnswerLabel(answerIndex: number) {
  return getAnswerLetter(answerIndex) + '.';
}

/**
 * Parses a JSON string into a question array.
 *
 * @param questions JSON string containing question data.
 * @returns Parsed question array or an empty array.
 */
export function parseQuestions(questions: string) {
  const parsed = JSON.parse(questions);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Normalizes question data from local storage or Supabase.
 *
 * @param questions Question data as an array, JSON string, null, or undefined.
 * @returns Normalized question array.
 */
export function normalizeQuestions(
  questions: QuestionBlock[] | string | null | undefined
) {
  if (!questions) return [];
  if (Array.isArray(questions)) return questions;
  return parseQuestions(questions);
}

/**
 * Maps one raw Supabase survey row into the normalized survey model.
 *
 * @param row Raw survey row returned by Supabase.
 * @returns Normalized survey object.
 */
export function mapSurveyRow(row: SurveyRow): Survey {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    endDate: row.end_date,
    category: row.category,
    questions: normalizeQuestions(row.questions),
  };
}

/**
 * Normalizes one locally stored survey.
 *
 * @param survey Locally stored survey.
 * @returns Normalized local survey.
 */
export function mapLocalSurvey(survey: Survey): Survey {
  return { ...survey, questions: normalizeQuestions(survey.questions) };
}

/**
 * Aggregates vote rows into a nested vote count map.
 *
 * @param votes Vote rows loaded from the database.
 * @returns Vote counts grouped by question index and answer index.
 */
export function countVotes(votes: VoteRow[]) {
  return votes.reduce<Record<number, Record<number, number>>>((result, vote) => {
    result[vote.question_index] ??= {};
    result[vote.question_index][vote.answer_index] ??= 0;
    result[vote.question_index][vote.answer_index] += 1;

    return result;
  }, {});
}

/**
 * Toggles one answer index inside a multi-select answer list.
 *
 * @param selected Currently selected answer indexes.
 * @param answerIndex Answer index to toggle.
 * @returns Updated selected answer indexes.
 */
export function toggleAnswer(selected: number[], answerIndex: number) {
  return selected.includes(answerIndex)
    ? selected.filter(index => index !== answerIndex)
    : [...selected, answerIndex];
}

/**
 * Converts selected answers into vote rows for database insertion.
 *
 * @param surveyId Current survey id.
 * @param selectedAnswers Selected answers grouped by question index.
 * @returns Vote rows ready for Supabase insert.
 */
export function buildVoteRows(
  surveyId: string,
  selectedAnswers: Record<number, number[]>
) {
  return Object.entries(selectedAnswers).flatMap(([questionIndex, answerIndexes]) =>
    answerIndexes.map(answerIndex => ({
      survey_id: surveyId,
      question_index: Number(questionIndex),
      answer_index: answerIndex,
    }))
  );
}

/**
 * Wraps a promise with a timeout guard.
 *
 * @template T Promise result type.
 * @param promise Promise that should be guarded.
 * @param timeoutMs Timeout duration in milliseconds.
 * @param message Error message used when the timeout is reached.
 * @returns The original promise result or a rejected timeout error.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}

/**
 * Creates a shallow copy of the base vote count map.
 *
 * @param baseVotes Stored vote counts grouped by question and answer.
 * @returns Copied vote count map.
 */
export function copyBaseVotes(baseVotes: Record<number, Record<number, number>>) {
  return Object.fromEntries(
    Object.entries(baseVotes).map(([index, answers]) => [Number(index), { ...answers }])
  );
}

/**
 * Combines saved votes with the currently selected local answers.
 *
 * @param baseVotes Stored vote counts from the database.
 * @param selectedAnswers Current local answer selections.
 * @returns Vote count map including saved votes and local selections.
 */
export function buildLiveVotes(
  baseVotes: Record<number, Record<number, number>>,
  selectedAnswers: Record<number, number[]>
) {
  const mergedVotes = copyBaseVotes(baseVotes);
  for (const [questionIndex, answerIndexes] of Object.entries(selectedAnswers)) {
    mergedVotes[Number(questionIndex)] ??= {};
    for (const answerIndex of answerIndexes) {
      mergedVotes[Number(questionIndex)][answerIndex] ??= 0;
      mergedVotes[Number(questionIndex)][answerIndex] += 1;
    }
  }
  return mergedVotes;
}

/**
 * Calculates the percentage value for one answer result.
 *
 * @param liveVotes Vote counts including saved and local votes.
 * @param questionIndex Index of the question.
 * @param answerIndex Index of the answer.
 * @returns Rounded percentage value.
 */
export function getPercentage(
  liveVotes: Record<number, Record<number, number>>,
  questionIndex: number,
  answerIndex: number
) {
  const questionVotes = liveVotes[questionIndex] || {};
  const total = Object.values(questionVotes).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  return Math.round(((questionVotes[answerIndex] || 0) / total) * 100);
}

/**
 * Checks whether any live vote result exists.
 *
 * @param liveVotes Vote counts grouped by question and answer.
 * @returns True if at least one answer has votes.
 */
export function hasLiveResults(liveVotes: Record<number, Record<number, number>>) {
  return Object.values(liveVotes).some(questionVotes =>
    Object.values(questionVotes).some(count => count > 0)
  );
}