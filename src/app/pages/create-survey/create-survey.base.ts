import { Directive } from '@angular/core';
import { buildQuestion, getQuestionPlaceholder, getSelectionHint } from './create-survey.helpers';
import { CreateSurveyPublishBase } from './create-survey.publish-base';
import { QuestionBlock } from './create-survey.types';

@Directive()
export class CreateSurveyBase extends CreateSurveyPublishBase {
  /**
   * Returns today's local date in YYYY-MM-DD format.
   *
   * @returns Local minimum date for the end date picker.
   */
  get minEndDate() {
    return this.formatLocalDate(new Date());
  }

  /**
   * Returns the current local datetime in YYYY-MM-DDTHH:mm format.
   *
   * @returns Local minimum datetime for the desktop date picker.
   */
  get minEndDateTime() {
    const now = new Date();
    now.setSeconds(0, 0);
    return `${this.formatLocalDate(now)}T${this.formatLocalTime(now)}`;
  }

  /**
   * Returns the minimum selectable time for the mobile time picker.
   *
   * Uses the current local time when today's date is selected.
   *
   * @returns Minimum time in HH:mm format or an empty string.
   */
  get minEndTime() {
    return this.endDateValue === this.minEndDate ? this.formatLocalTime(new Date()) : '';
  }

  /**
   * Opens or closes the category dropdown menu.
   */
  toggleCategoryMenu() {
    this.isCategoryMenuOpen = !this.isCategoryMenuOpen;
  }

  /**
   * Applies the selected category and closes the dropdown menu.
   *
   * @param category Selected category name.
   */
  selectCategory(category: string) {
    this.selectedCategory = category;
    this.isCategoryMenuOpen = false;
  }

  /**
   * Clears the survey title input.
   */
  clearSurveyTitle() {
    this.surveyTitle = '';
  }

  /**
   * Clears the survey description input.
   */
  clearSurveyDescription() {
    this.surveyDescription = '';
  }

  /**
   * Clears the selected survey end date.
   */
  clearSurveyEndDate() {
    this.surveyEndDate = '';
  }

  /**
   * Clears the selected category and closes the category dropdown.
   */
  clearSelectedCategory() {
    this.selectedCategory = '';
    this.isCategoryMenuOpen = false;
  }

  /**
   * Updates the date part of the survey end date while keeping the selected time.
   *
   * @param date Selected date value.
   */
  updateEndDate(date: string) {
    if (!date) return this.clearSurveyEndDate();
    this.surveyEndDate = `${date}T${this.endTimeValue}`;
  }

  /**
   * Updates the time part of the survey end date.
   *
   * @param time Selected time value.
   */
  updateEndTime(time: string) {
    if (!this.endDateValue) return;
    this.surveyEndDate = `${this.endDateValue}T${time || '12:00'}`;
  }

  /**
   * Opens the native browser date picker when supported.
   *
   * @param input Date input element.
   */
  openDatePicker(input: HTMLInputElement) {
    try {
      input.showPicker?.();
    } catch {
      input.focus();
      input.click();
    }
  }

  /**
   * Clears the text of one question.
   *
   * @param questionIndex Index of the question to clear.
   */
  clearQuestion(questionIndex: number) {
    this.questions[questionIndex].text = '';
  }

  /**
   * Clears one answer input without removing it.
   *
   * @param questionIndex Index of the question.
   * @param answerIndex Index of the answer.
   */
  clearAnswer(questionIndex: number, answerIndex: number) {
    this.questions[questionIndex].answers[answerIndex] = '';
  }

  /**
   * Adds a new empty answer input to a question.
   *
   * @param questionIndex Index of the question.
   */
  addAnswer(questionIndex: number) {
    this.questions[questionIndex].answers.push('');
  }

  /**
   * Adds the next editable question block to the survey builder.
   */
  addNextQuestion() {
    this.questions.push(buildQuestion(this.questions.length));
  }

  /**
   * Returns the default placeholder text for a question.
   *
   * @param questionIndex Index of the question.
   * @returns Placeholder text for the question.
   */
  getQuestionPlaceholder(questionIndex: number) {
    return getQuestionPlaceholder(questionIndex);
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

  /**
   * Provides a stable trackBy callback for index-based Angular lists.
   *
   * @param index Current item index.
   * @returns The unchanged item index.
   */
  trackByIndex(index: number) {
    return index;
  }

  /**
   * Converts an answer index into a visible label.
   *
   * @param answerIndex Index of the answer.
   * @returns A label like A., B., or C.
   */
  getAnswerLabel(answerIndex: number) {
    return String.fromCharCode(65 + answerIndex) + '.';
  }

  /**
   * Formats a date object as a local YYYY-MM-DD string.
   *
   * @param date Date to format.
   * @returns Formatted date string.
   */
  private formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formats a date object as a local HH:mm string.
   *
   * @param date Date to format.
   * @returns Formatted time string.
   */
  private formatLocalTime(date: Date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
