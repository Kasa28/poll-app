import { Directive } from '@angular/core';
import { buildVoteRows, getPercentage, hasLiveResults, toggleAnswer } from './survey-detail.helpers';
import { supabase } from '../../supabase';
import { SurveyDetailLoadBase } from './survey-detail.load-base';

/**
 * Extends the survey detail loading base with voting behavior.
 *
 * Handles answer selection, vote submission, live result percentages,
 * and submit status updates.
 */
@Directive()
export class SurveyDetailDataBase extends SurveyDetailLoadBase {
  /**
   * Saves selected answers unless the survey has ended.
   *
   * @returns A promise that resolves when the submit flow is finished.
   */
  async completeSurvey() {
    if (!this.survey || this.isPastSurvey) return;
    this.submitMessageSignal.set('');
    const voteRows = this.getSelectedVoteRows();
    if (!voteRows.length) return this.navigateHome();
    this.isSubmittingSignal.set(true);
    const { error } = await supabase.from('votes').insert(voteRows);
    if (error) return this.handleVoteInsertError(error);
    await this.finishSurveySubmission();
  }

  /**
   * Selects, replaces, or toggles an answer for one question.
   *
   * @param questionIndex Index of the selected question.
   * @param answerIndex Index of the selected answer.
   */
  selectAnswer(questionIndex: number, answerIndex: number) {
    if (!this.survey || this.isPastSurvey) return;
    const selectedAnswers = this.selectedAnswersSignal();
    const selected = selectedAnswers[questionIndex] || [];
    const question = this.survey.questions[questionIndex];
    this.selectedAnswersSignal.set({
      ...selectedAnswers,
      [questionIndex]: question?.allowMultiple ? toggleAnswer(selected, answerIndex) : [answerIndex],
    });
  }

  /**
   * Checks whether one answer is currently selected.
   *
   * @param questionIndex Index of the question.
   * @param answerIndex Index of the answer.
   * @returns True if the answer is selected.
   */
  isSelected(questionIndex: number, answerIndex: number) {
    return (this.selectedAnswersSignal()[questionIndex] || []).includes(answerIndex);
  }

  /**
   * Calculates the percentage for one answer result.
   *
   * @param questionIndex Index of the question.
   * @param answerIndex Index of the answer.
   * @returns Rounded percentage value.
   */
  getPercentage(questionIndex: number, answerIndex: number) {
    return getPercentage(this.liveVotes(), questionIndex, answerIndex);
  }

  /**
   * Checks whether at least one live result exists.
   *
   * @returns True if any answer has votes.
   */
  hasLiveResults() {
    return hasLiveResults(this.liveVotes());
  }

  /**
   * Converts the currently selected answers into vote rows.
   *
   * @returns Vote rows ready for database insertion.
   */
  private getSelectedVoteRows() {
    if (!this.survey) return [];
    return buildVoteRows(this.survey.id, this.selectedAnswersSignal());
  }

  /**
   * Handles vote insert errors after submitting the survey.
   *
   * @param error Supabase vote insert error.
   */
  private handleVoteInsertError(error: { message?: string }) {
    this.submitMessageSignal.set('Votes could not be saved.');
    console.log('Vote insert error:', error);
    this.isSubmittingSignal.set(false);
  }

  /**
   * Finishes a successful survey submission.
   *
   * Updates live votes, clears selected answers, reloads stored votes,
   * resets the submitting state, and navigates back home.
   *
   * @returns A promise that resolves after vote reload and navigation.
   */
  private async finishSurveySubmission() {
    this.baseVotesSignal.set(this.liveVotes());
    this.selectedAnswersSignal.set({});
    this.submitMessageSignal.set('Survey completed.');
    await this.loadVotes();
    this.isSubmittingSignal.set(false);
    await this.navigateHome();
  }
}