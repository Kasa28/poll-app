import { Directive } from '@angular/core';
import { getAnswerLabel, getAnswerLetter, getSelectionHint } from './survey-detail.helpers';
import { SurveyDetailDataBase } from './survey-detail.data-base';
import { QuestionBlock } from './survey-detail.types';

@Directive()
export class SurveyDetailBase extends SurveyDetailDataBase {
  /**
   * Exposes the current submit loading state for the template.
   *
   * @returns True while votes are being submitted.
   */
  get isSubmitting() {
    return this.isSubmittingSignal();
  }

  /**
   * Exposes the current submit status message for the template.
   *
   * @returns Current submit message.
   */
  get submitMessage() {
    return this.submitMessageSignal();
  }

  /**
   * Exposes the short re-vote cooldown state for the template.
   *
   * @returns True while the survey is temporarily blocked after a vote.
   */
  get isVoteBlocked() {
    return this.isVoteCooldownActive;
  }

  /**
   * Exposes the current re-vote cooldown message for the template.
   *
   * @returns Cooldown message or an empty string.
   */
  get voteCooldownMessage() {
    return this.getVoteCooldownMessage();
  }

  /**
   * Exposes the permanent single-vote restriction state for the template.
   *
   * @returns True if this device already voted in the survey.
   */
  get hasVotedAlready() {
    return this.hasAlreadyVoted;
  }

  /**
   * Exposes the one-vote-only message for the template.
   *
   * @returns User-facing message or an empty string.
   */
  get alreadyVotedMessage() {
    return this.getAlreadyVotedMessage();
  }

  /**
   * Converts an answer index into a visible label.
   *
   * @param answerIndex Index of the answer.
   * @returns Answer label like A. or B.
   */
  getAnswerLabel(answerIndex: number) {
    return getAnswerLabel(answerIndex);
  }

  /**
   * Converts an answer index into a plain answer letter.
   *
   * @param answerIndex Index of the answer.
   * @returns Answer letter like A or B.
   */
  getAnswerLetter(answerIndex: number) {
    return getAnswerLetter(answerIndex);
  }

  /**
   * Returns helper text for single- or multi-select questions.
   *
   * @param question Question block used to check the selection mode.
   * @returns User-facing selection hint.
   */
  getSelectionHint(question: QuestionBlock) {
    return getSelectionHint(question);
  }
}
