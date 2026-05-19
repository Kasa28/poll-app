import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../../supabase';

type QuestionBlock = {
  text: string;
  allowMultiple: boolean;
  answers: string[];
};

type PublishedSurvey = {
  id: string;
  title: string;
  description: string;
  endDate: string;
  category: string;
  questions: QuestionBlock[];
};

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

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get firstQuestion() {
    return this.questions[0];
  }

  get additionalQuestions() {
    return this.questions.slice(2);
  }

  get canPublish() {
    return this.isFormValid();
  }

  toggleCategoryMenu() {
    this.isCategoryMenuOpen = !this.isCategoryMenuOpen;
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
    this.isCategoryMenuOpen = false;
  }

  clearSurveyTitle() {
    this.surveyTitle = '';
  }

  clearSurveyDescription() {
    this.surveyDescription = '';
  }

  clearSurveyEndDate() {
    this.surveyEndDate = '';
  }

  clearSelectedCategory() {
    this.selectedCategory = '';
    this.isCategoryMenuOpen = false;
  }

  get endDateValue() {
    return this.surveyEndDate.split('T')[0] || '';
  }

  get endTimeValue() {
    return this.surveyEndDate.split('T')[1] || '12:00';
  }

  updateEndDate(date: string) {
    if (!date) return this.clearSurveyEndDate();
    this.surveyEndDate = `${date}T${this.endTimeValue}`;
  }

  updateEndTime(time: string) {
    if (!this.endDateValue) return;
    this.surveyEndDate = `${this.endDateValue}T${time || '12:00'}`;
  }

  openDatePicker(input: HTMLInputElement) {
    try {
      input.showPicker?.();
    } catch {
      input.focus();
      input.click();
    }
  }

  clearQuestion(questionIndex: number) {
    this.questions[questionIndex].text = '';
  }

  clearAnswer(questionIndex: number, answerIndex: number) {
    this.questions[questionIndex].answers[answerIndex] = '';
  }

  addAnswer(questionIndex: number) {
    this.questions[questionIndex].answers.push('');
  }

  addNextQuestion() {
    this.questions.push(this.buildQuestion(this.questions.length));
  }

  getQuestionPlaceholder(questionIndex: number) {
    if (questionIndex === 0) {
      return 'Which date would work best for you?';
    }
    if (questionIndex === 1) {
      return 'Choose the activities you prefer?';
    }
    return '';
  }

  getSelectionHint(question: QuestionBlock) {
    return question.allowMultiple
      ? 'More than one answer is possible.'
      : 'Only one answer can be selected.';
  }

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

  private normalizeQuestions() {
    return this.questions.map(question => ({
      text: question.text.trim() || 'Untitled question',
      allowMultiple: question.allowMultiple,
      answers: question.answers.map(answer => answer.trim() || 'Untitled answer'),
    }));
  }

  private replaceLocalSurveyId(oldId: string, newId: string) {
    const updatedSurveys = this.getSavedSurveys().map(survey =>
      survey.id === oldId ? { ...survey, id: newId } : survey
    );
    localStorage.setItem('publishedSurveys', JSON.stringify(updatedSurveys));
    const updatedSurvey = updatedSurveys.find(survey => survey.id === newId);
    if (updatedSurvey) localStorage.setItem('publishedSurvey', JSON.stringify(updatedSurvey));
  }

  private setPublishError() {
    this.publishError = 'Please fill out all fields before publishing.';
  }

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

  private buildQuestion(questionIndex: number): QuestionBlock {
    return {
      text: this.getQuestionPlaceholder(questionIndex),
      allowMultiple: false,
      answers: ['', ''],
    };
  }

  private saveSurveyLocally(survey: PublishedSurvey) {
    const savedSurveys = this.getSavedSurveys();
    savedSurveys.unshift(survey);
    localStorage.setItem('publishedSurveys', JSON.stringify(savedSurveys));
    localStorage.setItem('publishedSurvey', JSON.stringify(survey));
  }

  private getSavedSurveys(): PublishedSurvey[] {
    return JSON.parse(localStorage.getItem('publishedSurveys') || '[]');
  }

  private getInsertPayload(survey: PublishedSurvey) {
    return {
      title: survey.title,
      description: survey.description,
      end_date: survey.endDate,
      category: survey.category,
      questions: survey.questions,
    };
  }

  private async insertSurvey(survey: PublishedSurvey) {
    const firstTry = await this.insertWithId(survey);
    return firstTry.error ? this.retrySurveyInsert(survey, firstTry.error) : firstTry;
  }

  private insertWithId(survey: PublishedSurvey) {
    return supabase.from('surveys').insert({ id: survey.id, ...this.getInsertPayload(survey) }).select('id').single();
  }

  private async retrySurveyInsert(survey: PublishedSurvey, error: { message: string }) {
    console.log('Survey publish with custom id failed:', error);
    return supabase.from('surveys').insert(this.getInsertPayload(survey)).select('id').single();
  }

  private handlePublishError(error: { message: string }) {
    console.log('Survey publish error:', error);
    this.publishError = `Survey publish failed: ${error.message}`;
    this.isPublishing = false;
    this.syncView();
  }

  private async finishPublish(oldId: string, newId: string) {
    this.replaceLocalSurveyId(oldId, newId);
    if (this.isMobileView()) return this.goToSurvey(newId);
    this.pendingSurveyId = newId;
    this.showPublishSuccess = true;
    this.isPublishing = false;
    this.syncView();
  }

  private isMobileView() {
    return window.innerWidth <= 640;
  }

  private async goToSurvey(surveyId: string) {
    this.isPublishing = false;
    await this.router.navigate(['/survey', surveyId]);
  }

  private syncView() {
    this.cdr.detectChanges();
  }

  trackByIndex(index: number) {
    return index;
  }

  getAnswerLabel(answerIndex: number) {
    return String.fromCharCode(65 + answerIndex) + '.';
  }

  async closePublishSuccess() {
    this.showPublishSuccess = false;
    await this.goToSurvey(this.pendingSurveyId);
  }
}
