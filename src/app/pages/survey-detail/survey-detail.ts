import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { supabase } from '../../supabase';

/**
 * Describes one survey question with its answer options.
 */
type QuestionBlock = {
  text: string;
  allowMultiple: boolean;
  answers: string[];
};

/**
 * Normalized survey model used by the detail page view.
 */
type Survey = {
  id: string;
  title: string;
  description: string;
  endDate: string;
  category: string;
  questions: QuestionBlock[];
};

/**
 * Minimal vote row used for loading and saving survey answers.
 */
type VoteRow = {
  question_index: number;
  answer_index: number;
};

/**
 * Raw survey row returned by Supabase for the detail page.
 */
type SurveyRow = {
  id: string | number;
  title: string;
  description: string;
  end_date: string;
  category: string;
  questions: QuestionBlock[] | string | null;
};

/**
 * Displays one survey detail page, handles answer selection,
 * saves votes, loads stored vote counts, and renders live results.
 */
@Component({
  selector: 'app-survey-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './survey-detail.html',
  styleUrl: './survey-detail.scss',
})
export class SurveyDetail {
  survey?: Survey;
  isLoading = true;
  errorMessage = '';
  errorDetails = '';
  dataSource: 'database' | 'local' | '' = '';
  sourceNotice = '';
  private loadingTimeoutId?: number;
  private selectedAnswersSignal = signal<Record<number, number[]>>({});
  private baseVotesSignal = signal<Record<number, Record<number, number>>>({});
  private isSubmittingSignal = signal(false);
  private submitMessageSignal = signal('');
  private liveVotes = computed(() => this.buildLiveVotes());

  /**
   * Creates the survey detail component.
   *
   * @param route Current route used to read the survey id.
   * @param router Angular router used for navigation after submission.
   * @param cdr Angular change detector used to refresh the view after async work.
   */
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

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
   * Checks whether the current survey end date is already in the past.
   *
   * @returns True if the survey has ended.
   */
  get isPastSurvey() {
    if (!this.survey?.endDate) return false;
    return new Date(this.survey.endDate).getTime() < Date.now();
  }

  /**
   * Loads the survey data and then loads the stored votes.
   *
   * @returns A promise that resolves when the initial loading flow is finished.
   */
  async ngOnInit() {
    this.startLoadingWatchdog();
    try {
      await this.loadSurvey();
      await this.loadVotes();
    } catch (error) {
      this.handleInitError(error);
    } finally {
      this.finishLoading();
    }
  }

  /**
   * Starts a timeout guard for the initial loading state.
   */
  private startLoadingWatchdog() {
    this.loadingTimeoutId = window.setTimeout(() => this.handleLoadingTimeout(), 8000);
  }

  /**
   * Clears the loading watchdog after requests have finished.
   */
  private clearLoadingWatchdog() {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = undefined;
    }
  }

  /**
   * Saves the selected answers unless the survey has already ended.
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
   * Toggles or replaces the current answer selection for one question.
   *
   * @param questionIndex Index of the selected question.
   * @param answerIndex Index of the selected answer.
   */
  selectAnswer(questionIndex: number, answerIndex: number) {
    if (!this.survey || this.isPastSurvey) {
      return;
    }
    const selectedAnswers = this.selectedAnswersSignal();
    const selected = selectedAnswers[questionIndex] || [];
    const question = this.survey.questions[questionIndex];
    this.selectedAnswersSignal.set({
      ...selectedAnswers,
      [questionIndex]: question?.allowMultiple
        ? this.toggleAnswer(selected, answerIndex)
        : [answerIndex],
    });
  }

  /**
   * Checks whether one answer is currently selected.
   *
   * @param questionIndex Index of the question.
   * @param answerIndex Index of the answer.
   * @returns True if the answer is currently selected.
   */
  isSelected(questionIndex: number, answerIndex: number) {
    return (this.selectedAnswersSignal()[questionIndex] || []).includes(answerIndex);
  }

  /**
   * Calculates the percentage shown for one answer result.
   *
   * @param questionIndex Index of the question.
   * @param answerIndex Index of the answer.
   * @returns Rounded percentage value.
   */
  getPercentage(questionIndex: number, answerIndex: number) {
    const questionVotes = this.liveVotes()[questionIndex] || {};
    const total = Object.values(questionVotes).reduce((sum, value) => sum + value, 0);
    if (!total) {
      return 0;
    }
    return Math.round(((questionVotes[answerIndex] || 0) / total) * 100);
  }

  /**
   * Checks whether at least one live result count exists.
   *
   * @returns True when any result bar should be visible.
   */
  hasLiveResults() {
    return Object.values(this.liveVotes()).some(questionVotes =>
      Object.values(questionVotes).some(count => count > 0)
    );
  }

  /**
   * Returns the answer label used in the question list.
   *
   * @param answerIndex Index of the answer.
   * @returns Answer label like A. or B.
   */
  getAnswerLabel(answerIndex: number) {
    return this.getAnswerLetter(answerIndex) + '.';
  }

  /**
   * Returns the plain answer letter used in the results panel.
   *
   * @param answerIndex Index of the answer.
   * @returns Answer letter like A or B.
   */
  getAnswerLetter(answerIndex: number) {
    return String.fromCharCode(65 + answerIndex);
  }

  /**
   * Returns helper text for single- or multi-select questions.
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
   * Loads the survey from Supabase and falls back to local storage if needed.
   *
   * @returns A promise that resolves after the survey load attempt.
   */
  private async loadSurvey() {
    const surveyId = this.route.snapshot.paramMap.get('id');
    if (!surveyId) return this.setMissingSurveyError();
    const localSurvey = this.getLocalSurvey(surveyId);
    const result = await this.fetchSurvey(surveyId);
    if (result.data) return this.applyDatabaseSurvey(result.data);
    if (localSurvey) return this.applyLocalSurvey(localSurvey);
    this.applySurveyLoadError(result.error);
  }

  /**
   * Looks up the current survey in local fallback storage.
   *
   * @param surveyId Survey id from the route.
   * @returns A normalized local survey or undefined.
   */
  private getLocalSurvey(surveyId: string): Survey | undefined {
    const survey = this.getStoredSurveys().find(entry => entry.id === surveyId);
    return survey ? this.mapLocalSurvey(survey) : undefined;
  }

  /**
   * Maps one database row into the normalized survey detail model.
   *
   * @param row Raw survey row from Supabase.
   * @returns Normalized survey object.
   */
  private mapSurveyRow(row: SurveyRow): Survey {
    return {
      id: String(row.id),
      title: row.title,
      description: row.description,
      endDate: row.end_date,
      category: row.category,
      questions: this.normalizeQuestions(row.questions),
    };
  }

  /**
   * Normalizes the questions payload whether it is JSON or already parsed.
   *
   * @param questions Questions from Supabase or local storage.
   * @returns Normalized question array.
   */
  private normalizeQuestions(questions: QuestionBlock[] | string | null | undefined) {
    if (!questions) return [];
    if (Array.isArray(questions)) return questions;
    try {
      return this.parseQuestions(questions);
    } catch (error) {
      return this.handleQuestionParseError(error);
    }
  }

  /**
   * Loads the stored votes for the current survey.
   *
   * @returns A promise that resolves after votes are loaded.
   */
  private async loadVotes() {
    if (!this.survey) return;
    const result = await this.fetchVotes(this.survey.id);
    if (result.error) return this.handleVoteLoadError(result.error);
    this.baseVotesSignal.set(this.countVotes(result.data || []));
  }

  /**
   * Converts the current local answer selection into vote rows.
   *
   * @returns Vote rows ready for Supabase insert.
   */
  private getSelectedVoteRows() {
    if (!this.survey) return [];
    return Object.entries(this.selectedAnswersSignal()).flatMap(
      ([questionIndex, answerIndexes]) =>
        answerIndexes.map(answerIndex => ({
          survey_id: this.survey!.id,
          question_index: Number(questionIndex),
          answer_index: answerIndex,
        }))
    );
  }

  /**
   * Aggregates vote rows into a nested count map.
   *
   * @param votes Vote rows loaded from Supabase.
   * @returns Vote count map grouped by question and answer.
   */
  private countVotes(votes: VoteRow[]) {
    return votes.reduce<Record<number, Record<number, number>>>((result, vote) => {
      result[vote.question_index] ??= {};
      result[vote.question_index][vote.answer_index] ??= 0;
      result[vote.question_index][vote.answer_index]++;
      return result;
    }, {});
  }

  /**
   * Adds or removes one answer index for a multi-select question.
   *
   * @param selected Currently selected answer indexes.
   * @param answerIndex Answer index to toggle.
   * @returns Updated selected answer indexes.
   */
  private toggleAnswer(selected: number[], answerIndex: number) {
    return selected.includes(answerIndex)
      ? selected.filter(index => index !== answerIndex)
      : [...selected, answerIndex];
  }

  /**
   * Wraps async work with a timeout guard.
   *
   * @template T Promise result type.
   * @param promise Promise that should be guarded.
   * @param timeoutMs Timeout duration in milliseconds.
   * @param message Error message used when the timeout is reached.
   * @returns The original promise result or a rejected timeout error.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
    return Promise.race<T>([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      ),
    ]);
  }

  /**
   * Combines saved votes with current local selections for live previewing.
   *
   * @returns Vote count map including saved votes and selected answers.
   */
  private buildLiveVotes() {
    const mergedVotes = this.copyBaseVotes();
    this.applySelectedVotes(mergedVotes);
    return mergedVotes;
  }

  /**
   * Copies stored vote counters before local selections are merged in.
   *
   * @returns A copied vote count map.
   */
  private copyBaseVotes() {
    return Object.fromEntries(
      Object.entries(this.baseVotesSignal()).map(([index, answers]) => [
        Number(index),
        { ...answers },
      ])
    );
  }

  /**
   * Applies all current local selections to the live vote map.
   *
   * @param mergedVotes Vote map that receives the local selections.
   */
  private applySelectedVotes(mergedVotes: Record<number, Record<number, number>>) {
    for (const [questionIndex, answerIndexes] of Object.entries(this.selectedAnswersSignal())) {
      this.incrementSelectedAnswers(mergedVotes, Number(questionIndex), answerIndexes);
    }
  }

  /**
   * Increments all selected answers for one question.
   *
   * @param mergedVotes Vote map that should be updated.
   * @param questionIndex Index of the question.
   * @param answerIndexes Selected answer indexes.
   */
  private incrementSelectedAnswers(
    mergedVotes: Record<number, Record<number, number>>,
    questionIndex: number,
    answerIndexes: number[]
  ) {
    mergedVotes[questionIndex] ??= {};
    for (const answerIndex of answerIndexes) this.incrementVote(mergedVotes[questionIndex], answerIndex);
  }

  /**
   * Increments a single answer counter by one.
   *
   * @param questionVotes Vote counters for one question.
   * @param answerIndex Answer index to increment.
   */
  private incrementVote(questionVotes: Record<number, number>, answerIndex: number) {
    questionVotes[answerIndex] ??= 0;
    questionVotes[answerIndex] += 1;
  }

  /**
   * Stores a top-level loading error for the detail page.
   *
   * @param error Unknown initialization error.
   */
  private handleInitError(error: unknown) {
    console.log('Survey detail init error:', error);
    this.errorMessage = 'Survey could not be loaded.';
    this.errorDetails = error instanceof Error ? error.message : String(error);
  }

  /**
   * Finishes the loading phase and refreshes the template.
   */
  private finishLoading() {
    this.clearLoadingWatchdog();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /**
   * Ends loading with a timeout message when requests take too long.
   */
  private handleLoadingTimeout() {
    if (!this.isLoading) return;
    this.errorMessage = 'Survey loading timed out.';
    this.errorDetails = 'The detail page waited too long for the survey or votes request to finish.';
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /**
   * Navigates back to the home page.
   *
   * @returns A promise with the navigation result.
   */
  private navigateHome() {
    return this.router.navigate(['/']);
  }

  /**
   * Handles vote insert failures after clicking Complete survey.
   *
   * @param error Supabase vote insert error.
   */
  private handleVoteInsertError(error: { message?: string }) {
    this.submitMessageSignal.set('Votes could not be saved.');
    console.log('Vote insert error:', error);
    this.isSubmittingSignal.set(false);
  }

  /**
   * Finalizes a successful submission and reloads the latest vote counts.
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

  /**
   * Sets the error state when the route does not contain a survey id.
   */
  private setMissingSurveyError() {
    this.errorMessage = 'Survey could not be loaded.';
    this.errorDetails = 'Missing survey id in route.';
  }

  /**
   * Requests one survey row from Supabase by id.
   *
   * @param surveyId Survey id from the route.
   * @returns A promise with the survey row or an error.
   */
  private fetchSurvey(surveyId: string) {
    return this.withTimeout<{ data: SurveyRow | null; error: { message: string } | null }>(
      Promise.resolve(supabase.from('surveys').select('*').eq('id', surveyId).maybeSingle()),
      8000,
      'Survey request timed out.'
    );
  }

  /**
   * Applies the survey loaded from the database.
   *
   * @param data Raw survey row from Supabase.
   */
  private applyDatabaseSurvey(data: SurveyRow) {
    this.survey = this.mapSurveyRow(data);
    this.dataSource = 'database';
    this.sourceNotice = '';
    this.errorMessage = '';
    this.errorDetails = '';
  }

  /**
   * Applies the survey loaded from local fallback storage.
   *
   * @param localSurvey Local survey fallback.
   */
  private applyLocalSurvey(localSurvey: Survey) {
    this.survey = localSurvey;
    this.dataSource = 'local';
    this.sourceNotice = 'Survey was loaded from local storage because the database did not return a row.';
    console.log('Survey loaded from local storage fallback.');
  }

  /**
   * Stores the error shown when no survey row could be resolved.
   *
   * @param error Supabase load error or null when no row was returned.
   */
  private applySurveyLoadError(error: { message: string } | null) {
    this.errorMessage = 'Survey could not be loaded.';
    this.errorDetails = error?.message || 'No survey was returned from Supabase.';
    console.log('Survey load error:', error);
    this.dataSource = '';
    this.sourceNotice = '';
  }

  /**
   * Reads locally cached surveys for fallback usage.
   *
   * @returns Stored survey list from localStorage.
   */
  private getStoredSurveys(): Survey[] {
    return JSON.parse(localStorage.getItem('publishedSurveys') || '[]');
  }

  /**
   * Normalizes one locally stored survey into the detail-page shape.
   *
   * @param survey Locally stored survey.
   * @returns Normalized local survey.
   */
  private mapLocalSurvey(survey: Survey): Survey {
    return { ...survey, questions: this.normalizeQuestions(survey.questions) };
  }

  /**
   * Parses the questions JSON string returned by the backend.
   *
   * @param questions JSON string with question data.
   * @returns Parsed question array or an empty array.
   */
  private parseQuestions(questions: string) {
    const parsed = JSON.parse(questions);
    return Array.isArray(parsed) ? parsed : [];
  }

  /**
   * Handles invalid question JSON returned from the backend.
   *
   * @param error Unknown JSON parse error.
   * @returns Empty question array fallback.
   */
  private handleQuestionParseError(error: unknown) {
    console.log('Question parse error:', error);
    this.errorMessage = 'Survey data has an invalid question format.';
    this.errorDetails = 'The questions field could not be parsed into an array.';
    return [];
  }

  /**
   * Requests all stored votes for the current survey.
   *
   * @param surveyId Current survey id.
   * @returns A promise with vote rows or an error.
   */
  private fetchVotes(surveyId: string) {
    return this.withTimeout<{ data: VoteRow[] | null; error: { message: string } | null }>(
      Promise.resolve(supabase.from('votes').select('question_index, answer_index').eq('survey_id', surveyId)),
      8000,
      'Vote request timed out.'
    );
  }

  /**
   * Stores the vote loading error for debugging and status output.
   *
   * @param error Supabase vote loading error.
   */
  private handleVoteLoadError(error: { message: string }) {
    this.errorDetails = error.message;
    console.log('Vote load error:', error);
  }
}