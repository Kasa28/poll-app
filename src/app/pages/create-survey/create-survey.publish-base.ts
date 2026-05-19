import { ChangeDetectorRef, Directive } from '@angular/core';
import { Router } from '@angular/router';
import { supabase } from '../../supabase';
import {
  buildSurvey,
  getSurveyFormErrors,
  getInsertPayload,
  getSavedSurveys,
  isSurveyFormValid,
  replaceLocalSurveyId,
  saveSurveyLocally,
} from './create-survey.helpers';
import { PublishedSurvey, QuestionBlock } from './create-survey.types';

@Directive()
export class CreateSurveyPublishBase {
  private readonly publishSuccessDelayMs = 2000;
  private showValidationError = false;
  categories = [
    'Team Activities',
    'Health & Wellness',
    'Gaming & Entertainment',
    'Education & Learning',
    'Lifestyle & Preferences',
    'Technology & Innovation',
  ];
  isCategoryMenuOpen = false;
  selectedCategory = '';
  surveyTitle = '';
  surveyDescription = '';
  surveyEndDate = '';
  publishError = '';
  isPublishing = false;
  showPublishSuccess = false;
  pendingSurveyId = '';
  questions: QuestionBlock[] = [
    {
      text: 'Which date would work best for you?',
      allowMultiple: false,
      answers: ['', ''],
    },
  ];

  /**
   * Creates the survey creation component.
   *
   * @param router Angular router used to navigate after publishing.
   * @param cdr Angular change detector used to refresh the view after async updates.
   */
  constructor(
    protected router: Router,
    protected cdr: ChangeDetectorRef
  ) {}

  /**
   * Returns the first question block.
   *
   * @returns The first question in the questions array.
   */
  get firstQuestion() {
    return this.questions[0];
  }

  /**
   * Returns all additional questions after the first two starter questions.
   *
   * @returns A list of additional question blocks.
   */
  get additionalQuestions() {
    return this.questions.slice(2);
  }

  /**
   * Checks whether the survey is currently ready to be published.
   *
   * @returns True if all required fields are valid.
   */
  get canPublish() {
    return this.isFormValid();
  }

  /**
   * Returns only the date part of the survey end date.
   *
   * @returns Date value in YYYY-MM-DD format or an empty string.
   */
  get endDateValue() {
    return this.surveyEndDate.split('T')[0] || '';
  }

  /**
   * Returns only the time part of the survey end date.
   *
   * @returns Time value or the default time.
   */
  get endTimeValue() {
    return this.surveyEndDate.split('T')[1] || '12:00';
  }

  /**
   * Validates the form, saves the survey locally, and publishes it to Supabase.
   *
   * @returns A promise that resolves when publishing is finished or stopped by validation.
   */
  async publishSurvey() {
    this.publishError = '';
    if (!this.isFormValid()) return this.setPublishError();
    this.showValidationError = false;
    this.isPublishing = true;
    const survey = this.buildSurvey();
    this.saveSurveyLocally(survey);
    const result = await this.insertSurvey(survey);
    if (result.error) return this.handlePublishError(result.error);
    await this.finishPublish(survey.id, String(result.data?.id ?? survey.id));
  }

  /**
   * Checks whether the survey form contains all required values.
   *
   * @returns True if the survey form is valid.
   */
  private isFormValid() {
    return isSurveyFormValid(
      this.surveyTitle,
      this.surveyEndDate,
      this.selectedCategory,
      this.questions
    );
  }

  /**
   * Replaces a temporary local survey id with the id returned by Supabase.
   *
   * @param oldId Temporary local survey id.
   * @param newId Persisted Supabase survey id.
   */
  private replaceLocalSurveyId(oldId: string, newId: string) {
    replaceLocalSurveyId(oldId, newId);
  }

  /**
   * Sets the validation error shown before a publish attempt.
   */
  private setPublishError() {
    this.showValidationError = true;
    this.publishError = this.buildValidationErrorMessage();
  }

  /**
   * Refreshes the visible validation message while the user edits the form.
   */
  handleFormChange() {
    if (!this.showValidationError) return;
    this.publishError = this.buildValidationErrorMessage();
    if (!this.publishError) {
      this.showValidationError = false;
    }
  }

  /**
   * Builds the detailed validation message for incomplete fields.
   *
   * @returns Formatted validation message or an empty string when the form is valid.
   */
  private buildValidationErrorMessage() {
    const errors = getSurveyFormErrors(
      this.surveyTitle,
      this.surveyEndDate,
      this.selectedCategory,
      this.questions
    );
    if (!errors.length) return '';
    return `Please complete the survey before publishing:\n- ${errors.join('\n- ')}`;
  }

  /**
   * Builds the final survey object for local storage and Supabase publishing.
   *
   * @returns A complete published survey payload.
   */
  private buildSurvey(): PublishedSurvey {
    return buildSurvey(
      this.surveyTitle,
      this.surveyDescription,
      this.surveyEndDate,
      this.selectedCategory,
      this.questions
    );
  }

  /**
   * Saves a published survey in localStorage as fallback data.
   *
   * @param survey Survey payload to save.
   */
  private saveSurveyLocally(survey: PublishedSurvey) {
    saveSurveyLocally(survey);
  }

  /**
   * Reads the locally stored survey list.
   *
   * @returns Saved surveys from localStorage.
   */
  private getSavedSurveys(): PublishedSurvey[] {
    return getSavedSurveys();
  }

  /**
   * Converts the local survey model into the field names expected by Supabase.
   *
   * @param survey Survey payload to convert.
   * @returns Supabase insert payload.
   */
  private getInsertPayload(survey: PublishedSurvey) {
    return getInsertPayload(survey);
  }

  /**
   * Inserts the survey into Supabase and retries without the custom id if needed.
   *
   * @param survey Survey payload to insert.
   * @returns Supabase insert result.
   */
  private async insertSurvey(survey: PublishedSurvey) {
    const firstTry = await this.insertWithId(survey);
    return firstTry.error ? this.retrySurveyInsert(survey, firstTry.error) : firstTry;
  }

  /**
   * Inserts the survey into Supabase using the locally generated uuid.
   *
   * @param survey Survey payload to insert.
   * @returns Supabase insert result.
   */
  private insertWithId(survey: PublishedSurvey) {
    return supabase
      .from('surveys')
      .insert({ id: survey.id, ...this.getInsertPayload(survey) })
      .select('id')
      .single();
  }

  /**
   * Retries a failed insert without sending the custom id field.
   *
   * @param survey Survey payload to insert.
   * @param error Error from the first insert attempt.
   * @returns Supabase insert result.
   */
  private async retrySurveyInsert(survey: PublishedSurvey, error: { message: string }) {
    console.log('Survey publish with custom id failed:', error);
    return supabase
      .from('surveys')
      .insert(this.getInsertPayload(survey))
      .select('id')
      .single();
  }

  /**
   * Stores the publish error and refreshes the UI.
   *
   * @param error Supabase publish error.
   */
  private handlePublishError(error: { message: string }) {
    console.log('Survey publish error:', error);
    this.publishError = `Survey publish failed: ${error.message}`;
    this.isPublishing = false;
    this.syncView();
  }

  /**
   * Finishes the publish flow after Supabase saved the survey.
   *
   * @param oldId Temporary local survey id.
   * @param newId Persisted survey id.
   * @returns A promise that resolves after success handling is finished.
   */
  private async finishPublish(oldId: string, newId: string) {
    this.replaceLocalSurveyId(oldId, newId);
    this.pendingSurveyId = newId;
    this.showPublishSuccess = true;
    this.isPublishing = false;
    this.syncView();
    window.setTimeout(() => void this.closePublishSuccess(), this.publishSuccessDelayMs);
  }

  /**
   * Navigates to the newly created survey detail page.
   *
   * @param surveyId Id of the survey to open.
   * @returns A promise that resolves after navigation.
   */
  private async goToSurvey(surveyId: string) {
    this.isPublishing = false;
    await this.router.navigate(['/survey', surveyId]);
  }

  /**
   * Forces Angular to refresh the UI after async state changes.
   */
  private syncView() {
    this.cdr.detectChanges();
  }

  /**
   * Closes the publish success message and opens the created survey.
   *
   * @returns A promise that resolves after navigation.
   */
  async closePublishSuccess() {
    this.showPublishSuccess = false;
    await this.goToSurvey(this.pendingSurveyId);
  }
}
