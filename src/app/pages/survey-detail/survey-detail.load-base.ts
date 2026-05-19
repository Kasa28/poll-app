import { ChangeDetectorRef, Directive, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  buildLiveVotes,
  countVotes,
  isPastSurvey,
  mapLocalSurvey,
  mapSurveyRow,
  normalizeQuestions,
  withTimeout,
} from './survey-detail.helpers';
import { supabase } from '../../supabase';
import { QuestionBlock, Survey, SurveyRow, VoteRow } from './survey-detail.types';

/**
 * Base directive class for loading survey detail data.
 *
 * Handles survey loading, local fallback loading, vote loading,
 * loading timeout handling, shared signals, and shared navigation helpers.
 */
@Directive()
export class SurveyDetailLoadBase {
  survey?: Survey;
  isLoading = true;
  errorMessage = '';
  errorDetails = '';
  dataSource: 'database' | 'local' | '' = '';
  sourceNotice = '';
  private loadingTimeoutId?: number;
  protected selectedAnswersSignal = signal<Record<number, number[]>>({});
  protected baseVotesSignal = signal<Record<number, Record<number, number>>>({});
  protected isSubmittingSignal = signal(false);
  protected submitMessageSignal = signal('');
  protected liveVotes = computed(() => this.buildLiveVotes());

  /**
   * Creates the survey detail loading base class.
   *
   * @param route Current route used to read the survey id.
   * @param router Angular router used for navigation.
   * @param cdr Angular change detector used to refresh the view after async work.
   */
  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected cdr: ChangeDetectorRef
  ) {}

  /**
   * Checks whether the current survey has already ended.
   *
   * @returns True if the survey end date is in the past.
   */
  get isPastSurvey() {
    return isPastSurvey(this.survey?.endDate);
  }

  /**
   * Loads the survey data and its stored votes.
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
   * Normalizes the questions payload and handles invalid JSON.
   *
   * @param questions Questions from Supabase or local storage.
   * @returns Normalized question array.
   */
  protected normalizeQuestions(questions: QuestionBlock[] | string | null | undefined) {
    try {
      return normalizeQuestions(questions);
    } catch (error) {
      return this.handleQuestionParseError(error);
    }
  }

  /**
   * Loads stored votes for the current survey.
   *
   * @returns A promise that resolves after votes are loaded.
   */
  protected async loadVotes() {
    if (!this.survey) return;
    const result = await this.fetchVotes(this.survey.id);
    if (result.error) return this.handleVoteLoadError(result.error);
    this.baseVotesSignal.set(countVotes(result.data || []));
  }

  /**
   * Navigates back to the home page.
   *
   * @returns A promise with the navigation result.
   */
  protected navigateHome() {
    return this.router.navigate(['/']);
  }

  /**
   * Builds live vote counts from saved votes and current selections.
   *
   * @returns Live vote count map.
   */
  protected buildLiveVotes() {
    return buildLiveVotes(this.baseVotesSignal(), this.selectedAnswersSignal());
  }

  /**
   * Starts a timeout guard for the initial loading state.
   */
  private startLoadingWatchdog() {
    this.loadingTimeoutId = window.setTimeout(() => this.handleLoadingTimeout(), 8000);
  }

  /**
   * Clears the loading timeout guard.
   */
  private clearLoadingWatchdog() {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = undefined;
    }
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
    return mapSurveyRow(row);
  }

  /**
   * Handles unexpected errors during the initial loading flow.
   *
   * @param error Unknown initialization error.
   */
  private handleInitError(error: unknown) {
    console.log('Survey detail init error:', error);
    this.errorMessage = 'Survey could not be loaded.';
    this.errorDetails = error instanceof Error ? error.message : String(error);
  }

  /**
   * Finishes the loading state and refreshes the view.
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
    return withTimeout<{ data: SurveyRow | null; error: { message: string } | null }>(
      Promise.resolve(supabase.from('surveys').select('*').eq('id', surveyId).maybeSingle()),
      8000,
      'Survey request timed out.'
    );
  }

  /**
   * Applies a survey loaded from the database.
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
   * Applies a survey loaded from local fallback storage.
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
   * Normalizes one locally stored survey.
   *
   * @param survey Locally stored survey.
   * @returns Normalized local survey.
   */
  private mapLocalSurvey(survey: Survey): Survey {
    return mapLocalSurvey(survey);
  }

  /**
   * Handles invalid question JSON returned from the backend.
   *
   * @param error Unknown question parse error.
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
    return withTimeout<{ data: VoteRow[] | null; error: { message: string } | null }>(
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