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
  private liveVotes = computed(() => {
    const mergedVotes: Record<number, Record<number, number>> = {};
    const baseVotes = this.baseVotesSignal();

    for (const [questionIndex, answers] of Object.entries(baseVotes)) {
      mergedVotes[Number(questionIndex)] = { ...answers };
    }

    for (const [questionIndex, answerIndexes] of Object.entries(this.selectedAnswersSignal())) {
      const numericQuestionIndex = Number(questionIndex);
      mergedVotes[numericQuestionIndex] ??= {};

      for (const answerIndex of answerIndexes) {
        mergedVotes[numericQuestionIndex][answerIndex] ??= 0;
        mergedVotes[numericQuestionIndex][answerIndex] += 1;
      }
    }

    return mergedVotes;
  });

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

  async ngOnInit() {
    this.startLoadingWatchdog();

    try {
      await this.loadSurvey();
      await this.loadVotes();
    } catch (error) {
      console.log('Survey detail init error:', error);
      this.errorMessage = 'Survey could not be loaded.';
      this.errorDetails = error instanceof Error ? error.message : String(error);
    } finally {
      this.clearLoadingWatchdog();
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private startLoadingWatchdog() {
    this.loadingTimeoutId = window.setTimeout(() => {
      if (!this.isLoading) {
        return;
      }

      this.errorMessage = 'Survey loading timed out.';
      this.errorDetails =
        'The detail page waited too long for the survey or votes request to finish.';
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 8000);
  }

  private clearLoadingWatchdog() {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = undefined;
    }
  }

  async completeSurvey() {
    if (!this.survey) {
      return;
    }

    this.submitMessageSignal.set('');
    const voteRows = this.getSelectedVoteRows();

    if (!voteRows.length) {
      await this.router.navigate(['/']);
      return;
    }

    this.isSubmittingSignal.set(true);
    const { error } = await supabase.from('votes').insert(voteRows);

    if (error) {
      this.submitMessageSignal.set('Votes could not be saved.');
      console.log('Vote insert error:', error);
      this.isSubmittingSignal.set(false);
      return;
    }

    this.baseVotesSignal.set(this.liveVotes());
    this.selectedAnswersSignal.set({});
    this.submitMessageSignal.set('Survey completed.');
    await this.loadVotes();
    this.isSubmittingSignal.set(false);
    await this.router.navigate(['/']);
  }

  selectAnswer(questionIndex: number, answerIndex: number) {
    if (!this.survey) {
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

  private async loadSurvey() {
    const surveyId = this.route.snapshot.paramMap.get('id');

    if (!surveyId) {
      this.errorMessage = 'Survey could not be loaded.';
      this.errorDetails = 'Missing survey id in route.';
      return;
    }

    const localSurvey = this.getLocalSurvey(surveyId);

    const { data, error } = await this.withTimeout<{ data: SurveyRow | null; error: { message: string } | null }>(
      Promise.resolve(
        supabase
          .from('surveys')
          .select('*')
          .eq('id', surveyId)
          .maybeSingle()
      ),
      8000,
      'Survey request timed out.'
    );

    if (data) {
      this.survey = this.mapSurveyRow(data);
      this.dataSource = 'database';
      this.sourceNotice = '';
      this.errorMessage = '';
      this.errorDetails = '';
      return;
    }

    if (error || !data) {
      if (localSurvey) {
        this.survey = localSurvey;
        this.dataSource = 'local';
        this.sourceNotice =
          'Survey was loaded from local storage because the database did not return a row.';
        console.log('Survey loaded from local storage fallback.');
        return;
      }

      this.errorMessage = 'Survey could not be loaded.';
      this.errorDetails = error?.message || 'No survey was returned from Supabase.';
      console.log('Survey load error:', error);
      this.dataSource = '';
      this.sourceNotice = '';
      return;
    }
  }

  private getLocalSurvey(surveyId: string): Survey | undefined {
    const surveys = JSON.parse(localStorage.getItem('publishedSurveys') || '[]');
    const survey = surveys.find((entry: Survey) => entry.id === surveyId);

    if (!survey) {
      return undefined;
    }

    return {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      endDate: survey.endDate,
      category: survey.category,
      questions: this.normalizeQuestions(survey.questions),
    };
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
    if (!questions) {
      return [];
    }

    if (Array.isArray(questions)) {
      return questions;
    }

    try {
      const parsed = JSON.parse(questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.log('Question parse error:', error);
      this.errorMessage = 'Survey data has an invalid question format.';
      this.errorDetails = 'The questions field could not be parsed into an array.';
      return [];
    }
  }

  private async loadVotes() {
    if (!this.survey) {
      return;
    }

    const { data, error } = await this.withTimeout<{ data: VoteRow[] | null; error: { message: string } | null }>(
      Promise.resolve(
        supabase
          .from('votes')
          .select('question_index, answer_index')
          .eq('survey_id', this.survey.id)
      ),
      8000,
      'Vote request timed out.'
    );

    if (error) {
      this.errorDetails = error.message;
      console.log('Vote load error:', error);
      return;
    }

    this.baseVotesSignal.set(this.countVotes(data || []));
  }

  private getSelectedVoteRows() {
    if (!this.survey) {
      return [];
    }

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
}
