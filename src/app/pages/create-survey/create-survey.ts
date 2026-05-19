import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../../supabase';

/**
 * Describes one editable question block inside the survey builder.
 */
type QuestionBlock = {
  text: string;
  allowMultiple: boolean;
  answers: string[];
};

/**
 * Represents the survey payload that is stored locally and sent to Supabase.
 */
type PublishedSurvey = {
  id: string;
  title: string;
  description: string;
  endDate: string;
  category: string;
  questions: QuestionBlock[];
};

/**
 * Handles the survey creation flow, draft state,
 * category selection, validation, local saving, and publishing to Supabase.
 */
@Component({
  selector: 'app-create-survey',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-survey.html',
  styleUrl: './create-survey.scss',
})
export class CreateSurvey {
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
    private router: Router,
    private cdr: ChangeDetectorRef
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
    this.questions.push(this.buildQuestion(this.questions.length));
  }

  /**
   * Returns the default placeholder text for starter questions.
   *
   * @param questionIndex Index of the question.
   * @returns Placeholder text for the question.
   */
  getQuestionPlaceholder(questionIndex: number) {
    if (questionIndex === 0) {
      return 'Which date would work best for you?';
    }

    if (questionIndex === 1) {
      return 'Choose the activities you prefer?';
    }

    return '';
  }

  /**
   * Returns helper text that explains whether one or multiple answers are allowed.
   *
   * @param question Question block used to check the selection mode.
   * @returns User-facing helper text.
   */
  getSelectionHint(question: QuestionBlock) {
    return question.allowMultiple
      ? 'More than one answer is possible.'
      : 'Only one answer can be selected.';
  }

  /**
   * Validates the form, saves the survey locally, and publishes it to Supabase.
   *
   * @returns A promise that resolves when publishing is finished or stopped by validation.
   */
  async publishSurvey() {
    this.publishError = '';

    if (!this.isFormValid()) return this.setPublishError();

    this.isPublishing = true;

    const survey = this.buildSurvey();

    this.saveSurveyLocally(survey);

    const result = await this.insertSurvey(survey);

    if (result.error) return this.handlePublishError(result.error);

    await this.finishPublish(survey.id, String(result.data?.id ?? survey.id));
  }

  /**
   * Checks whether all required survey fields are filled.
   *
   * @returns True if the survey form is valid.
   */
  private isFormValid() {
    if (!this.surveyTitle.trim() || !this.surveyEndDate || !this.selectedCategory) {
      return false;
    }

    return this.questions.every(
      question =>
        question.text.trim() &&
        question.answers.length >= 2 &&
        question.answers.every(answer => answer.trim())
    );
  }

  /**
   * Trims all question and answer values and fills missing values with fallback text.
   *
   * @returns Normalized question blocks.
   */
  private normalizeQuestions() {
    return this.questions.map(question => ({
      text: question.text.trim() || 'Untitled question',
      allowMultiple: question.allowMultiple,
      answers: question.answers.map(answer => answer.trim() || 'Untitled answer'),
    }));
  }

  /**
   * Replaces a temporary local survey id with the id returned by Supabase.
   *
   * @param oldId Temporary local survey id.
   * @param newId Persisted Supabase survey id.
   */
  private replaceLocalSurveyId(oldId: string, newId: string) {
    const updatedSurveys = this.getSavedSurveys().map(survey =>
      survey.id === oldId ? { ...survey, id: newId } : survey
    );

    localStorage.setItem('publishedSurveys', JSON.stringify(updatedSurveys));

    const updatedSurvey = updatedSurveys.find(survey => survey.id === newId);

    if (updatedSurvey) localStorage.setItem('publishedSurvey', JSON.stringify(updatedSurvey));
  }

  /**
   * Sets the validation error shown before a publish attempt.
   */
  private setPublishError() {
    this.publishError = 'Please fill out all fields before publishing.';
  }

  /**
   * Builds the final survey object for local storage and Supabase publishing.
   *
   * @returns A complete survey payload.
   */
  private buildSurvey(): PublishedSurvey {
    return {
      id: crypto.randomUUID(),
      title: this.surveyTitle.trim(),
      description: this.surveyDescription.trim(),
      endDate: this.surveyEndDate,
      category: this.selectedCategory,
      questions: this.normalizeQuestions(),
    };
  }

  /**
   * Creates a new empty question block.
   *
   * @param questionIndex Index used to choose the default question placeholder.
   * @returns A new question block.
   */
  private buildQuestion(questionIndex: number): QuestionBlock {
    return {
      text: this.getQuestionPlaceholder(questionIndex),
      allowMultiple: false,
      answers: ['', ''],
    };
  }

  /**
   * Saves a published survey in localStorage as fallback data.
   *
   * @param survey Survey payload to save.
   */
  private saveSurveyLocally(survey: PublishedSurvey) {
    const savedSurveys = this.getSavedSurveys();

    savedSurveys.unshift(survey);

    localStorage.setItem('publishedSurveys', JSON.stringify(savedSurveys));
    localStorage.setItem('publishedSurvey', JSON.stringify(survey));
  }

  /**
   * Reads the locally stored survey list.
   *
   * @returns Saved surveys from localStorage.
   */
  private getSavedSurveys(): PublishedSurvey[] {
    return JSON.parse(localStorage.getItem('publishedSurveys') || '[]');
  }

  /**
   * Converts the local survey model into the field names expected by Supabase.
   *
   * @param survey Survey payload to convert.
   * @returns Supabase insert payload.
   */
  private getInsertPayload(survey: PublishedSurvey) {
    return {
      title: survey.title,
      description: survey.description,
      end_date: survey.endDate,
      category: survey.category,
      questions: survey.questions,
    };
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

    if (this.isMobileView()) return this.goToSurvey(newId);

    this.pendingSurveyId = newId;
    this.showPublishSuccess = true;
    this.isPublishing = false;

    this.syncView();
  }

  /**
   * Checks whether the current viewport should use mobile publish behavior.
   *
   * @returns True if the viewport width is mobile-sized.
   */
  private isMobileView() {
    return window.innerWidth <= 640;
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
   * Closes the publish success message and opens the created survey.
   *
   * @returns A promise that resolves after navigation.
   */
  async closePublishSuccess() {
    this.showPublishSuccess = false;

    await this.goToSurvey(this.pendingSurveyId);
  }
}