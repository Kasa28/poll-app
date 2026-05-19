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
