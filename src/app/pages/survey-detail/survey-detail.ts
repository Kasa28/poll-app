import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { supabase } from '../../supabase';

type QuestionBlock = {
  text: string;
  allowMultiple: boolean;
  answers: string[];
};

type Survey = {
  id: string;
  title: string;
  description: string;
  endDate: string;
  category: string;
  questions: QuestionBlock[];
};

type VoteRow = {
  question_index: number;
  answer_index: number;
};

type SurveyRow = {
  id: string | number;
  title: string;
  description: string;
  end_date: string;
  category: string;
  questions: QuestionBlock[] | string | null;
};

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get isSubmitting() {
    return this.isSubmittingSignal();
  }

  get submitMessage() {
    return this.submitMessageSignal();
  }

  get isPastSurvey() {
    if (!this.survey?.endDate) return false;
    return new Date(this.survey.endDate).getTime() < Date.now();
  }

  async ngOnInit() {
    this.startLoadingWatchdog();
    try {
      await this.loadSurvey();
      await this.loadVotes();
    } catch (error) { this.handleInitError(error); }
    finally { this.finishLoading(); }
  }

  private startLoadingWatchdog() {
    this.loadingTimeoutId = window.setTimeout(() => this.handleLoadingTimeout(), 8000);
  }

  private clearLoadingWatchdog() {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = undefined;
    }
  }

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

  isSelected(questionIndex: number, answerIndex: number) {
    return (this.selectedAnswersSignal()[questionIndex] || []).includes(answerIndex);
  }

  getPercentage(questionIndex: number, answerIndex: number) {
    const questionVotes = this.liveVotes()[questionIndex] || {};
    const total = Object.values(questionVotes).reduce((sum, value) => sum + value, 0);
    if (!total) {
      return 0;
    }
    return Math.round(((questionVotes[answerIndex] || 0) / total) * 100);
  }

  hasLiveResults() {
    return Object.values(this.liveVotes()).some(questionVotes =>
      Object.values(questionVotes).some(count => count > 0)
    );
  }

  getAnswerLabel(answerIndex: number) {
    return this.getAnswerLetter(answerIndex) + '.';
  }

  getAnswerLetter(answerIndex: number) {
    return String.fromCharCode(65 + answerIndex);
  }

  getSelectionHint(question: QuestionBlock) {
    return question.allowMultiple
      ? 'More than one answer is possible.'
      : 'Only one answer can be selected.';
  }

  private async loadSurvey() {
    const surveyId = this.route.snapshot.paramMap.get('id');
    if (!surveyId) return this.setMissingSurveyError();
    const localSurvey = this.getLocalSurvey(surveyId);
    const result = await this.fetchSurvey(surveyId);
    if (result.data) return this.applyDatabaseSurvey(result.data);
    if (localSurvey) return this.applyLocalSurvey(localSurvey);
    this.applySurveyLoadError(result.error);
  }

  private getLocalSurvey(surveyId: string): Survey | undefined {
    const survey = this.getStoredSurveys().find(entry => entry.id === surveyId);
    return survey ? this.mapLocalSurvey(survey) : undefined;
  }

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

  private normalizeQuestions(questions: QuestionBlock[] | string | null | undefined) {
    if (!questions) return [];
    if (Array.isArray(questions)) return questions;
    try {
      return this.parseQuestions(questions);
    } catch (error) {
      return this.handleQuestionParseError(error);
    }
  }

  private async loadVotes() {
    if (!this.survey) return;
    const result = await this.fetchVotes(this.survey.id);
    if (result.error) return this.handleVoteLoadError(result.error);
    this.baseVotesSignal.set(this.countVotes(result.data || []));
  }

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

  private countVotes(votes: VoteRow[]) {
    return votes.reduce<Record<number, Record<number, number>>>((result, vote) => {
      result[vote.question_index] ??= {};
      result[vote.question_index][vote.answer_index] ??= 0;
      result[vote.question_index][vote.answer_index]++;

      return result;
    }, {});
  }

  private toggleAnswer(selected: number[], answerIndex: number) {
    return selected.includes(answerIndex)
      ? selected.filter(index => index !== answerIndex)
      : [...selected, answerIndex];
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
    return Promise.race<T>([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      ),
    ]);
  }

  private buildLiveVotes() {
    const mergedVotes = this.copyBaseVotes();
    this.applySelectedVotes(mergedVotes);
    return mergedVotes;
  }

  private copyBaseVotes() {
    return Object.fromEntries(
      Object.entries(this.baseVotesSignal()).map(([index, answers]) => [Number(index), { ...answers }])
    );
  }

  private applySelectedVotes(mergedVotes: Record<number, Record<number, number>>) {
    for (const [questionIndex, answerIndexes] of Object.entries(this.selectedAnswersSignal())) {
      this.incrementSelectedAnswers(mergedVotes, Number(questionIndex), answerIndexes);
    }
  }

  private incrementSelectedAnswers(mergedVotes: Record<number, Record<number, number>>, questionIndex: number, answerIndexes: number[]) {
    mergedVotes[questionIndex] ??= {};
    for (const answerIndex of answerIndexes) this.incrementVote(mergedVotes[questionIndex], answerIndex);
  }

  private incrementVote(questionVotes: Record<number, number>, answerIndex: number) {
    questionVotes[answerIndex] ??= 0;
    questionVotes[answerIndex] += 1;
  }

  private handleInitError(error: unknown) {
    console.log('Survey detail init error:', error);
    this.errorMessage = 'Survey could not be loaded.';
    this.errorDetails = error instanceof Error ? error.message : String(error);
  }

  private finishLoading() {
    this.clearLoadingWatchdog();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private handleLoadingTimeout() {
    if (!this.isLoading) return;
    this.errorMessage = 'Survey loading timed out.';
    this.errorDetails = 'The detail page waited too long for the survey or votes request to finish.';
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private navigateHome() {
    return this.router.navigate(['/']);
  }

  private handleVoteInsertError(error: { message?: string }) {
    this.submitMessageSignal.set('Votes could not be saved.');
    console.log('Vote insert error:', error);
    this.isSubmittingSignal.set(false);
  }

  private async finishSurveySubmission() {
    this.baseVotesSignal.set(this.liveVotes());
    this.selectedAnswersSignal.set({});
    this.submitMessageSignal.set('Survey completed.');
    await this.loadVotes();
    this.isSubmittingSignal.set(false);
    await this.navigateHome();
  }

  private setMissingSurveyError() {
    this.errorMessage = 'Survey could not be loaded.';
    this.errorDetails = 'Missing survey id in route.';
  }

  private fetchSurvey(surveyId: string) {
    return this.withTimeout<{ data: SurveyRow | null; error: { message: string } | null }>(
      Promise.resolve(supabase.from('surveys').select('*').eq('id', surveyId).maybeSingle()),
      8000,
      'Survey request timed out.'
    );
  }

  private applyDatabaseSurvey(data: SurveyRow) {
    this.survey = this.mapSurveyRow(data);
    this.dataSource = 'database';
    this.sourceNotice = '';
    this.errorMessage = '';
    this.errorDetails = '';
  }

  private applyLocalSurvey(localSurvey: Survey) {
    this.survey = localSurvey;
    this.dataSource = 'local';
    this.sourceNotice = 'Survey was loaded from local storage because the database did not return a row.';
    console.log('Survey loaded from local storage fallback.');
  }

  private applySurveyLoadError(error: { message: string } | null) {
    this.errorMessage = 'Survey could not be loaded.';
    this.errorDetails = error?.message || 'No survey was returned from Supabase.';
    console.log('Survey load error:', error);
    this.dataSource = '';
    this.sourceNotice = '';
  }

  private getStoredSurveys(): Survey[] {
    return JSON.parse(localStorage.getItem('publishedSurveys') || '[]');
  }

  private mapLocalSurvey(survey: Survey): Survey {
    return { ...survey, questions: this.normalizeQuestions(survey.questions) };
  }

  private parseQuestions(questions: string) {
    const parsed = JSON.parse(questions);
    return Array.isArray(parsed) ? parsed : [];
  }

  private handleQuestionParseError(error: unknown) {
    console.log('Question parse error:', error);
    this.errorMessage = 'Survey data has an invalid question format.';
    this.errorDetails = 'The questions field could not be parsed into an array.';
    return [];
  }

  private fetchVotes(surveyId: string) {
    return this.withTimeout<{ data: VoteRow[] | null; error: { message: string } | null }>(
      Promise.resolve(supabase.from('votes').select('question_index, answer_index').eq('survey_id', surveyId)),
      8000,
      'Vote request timed out.'
    );
  }

  private handleVoteLoadError(error: { message: string }) {
    this.errorDetails = error.message;
    console.log('Vote load error:', error);
  }
}
