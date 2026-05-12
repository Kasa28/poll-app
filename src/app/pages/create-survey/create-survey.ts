import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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

  questions: QuestionBlock[] = [
    {
      text: 'Which date would work best for you?',
      allowMultiple: false,
      answers: ['', ''],
    },
  ];

  constructor(private router: Router) {}

  get firstQuestion() {
    return this.questions[0];
  }

  get additionalQuestions() {
    return this.questions.slice(1);
  }

  toggleCategoryMenu() {
    this.isCategoryMenuOpen = !this.isCategoryMenuOpen;
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
    this.isCategoryMenuOpen = false;
  }

  addAnswer(questionIndex: number) {
    const question = this.questions[questionIndex];

    if (question.answers.length < 6) {
      question.answers.push('');
    }
  }

  addNextQuestion() {
    this.questions.push({
      text: '',
      allowMultiple: false,
      answers: ['', ''],
    });
  }

  async publishSurvey() {
    this.publishError = '';

    const survey: PublishedSurvey = {
      id: crypto.randomUUID(),
      title: this.surveyTitle || 'Created survey',
      description: this.surveyDescription,
      endDate: this.surveyEndDate,
      category: this.selectedCategory || 'General',
      questions: this.normalizeQuestions(),
    };

    const savedSurveys = JSON.parse(
      localStorage.getItem('publishedSurveys') || '[]'
    );

    savedSurveys.unshift(survey);

    localStorage.setItem('publishedSurveys', JSON.stringify(savedSurveys));
    localStorage.setItem('publishedSurvey', JSON.stringify(survey));

    const insertPayload = {
      title: survey.title,
      description: survey.description,
      end_date: survey.endDate,
      category: survey.category,
      questions: survey.questions,
    };

    let { data, error } = await supabase
      .from('surveys')
      .insert({
        id: survey.id,
        ...insertPayload,
      })
      .select('id')
      .single();

    if (error) {
      console.log('Survey publish with custom id failed:', error);

      const retryResult = await supabase
        .from('surveys')
        .insert(insertPayload)
        .select('id')
        .single();

      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.log('Survey publish error:', error);
      this.publishError = `Survey publish failed: ${error.message}`;
      return;
    }

    const savedSurveyId = String(data?.id ?? survey.id);
    this.replaceLocalSurveyId(survey.id, savedSurveyId);

    await this.router.navigate(['/survey', savedSurveyId]);
  }

  private normalizeQuestions() {
    return this.questions.map(question => ({
      text: question.text.trim() || 'Untitled question',
      allowMultiple: question.allowMultiple,
      answers: question.answers.map(answer => answer.trim() || 'Untitled answer'),
    }));
  }

  private replaceLocalSurveyId(oldId: string, newId: string) {
    const savedSurveys: PublishedSurvey[] = JSON.parse(
      localStorage.getItem('publishedSurveys') || '[]'
    );

    const updatedSurveys = savedSurveys.map(survey =>
      survey.id === oldId ? { ...survey, id: newId } : survey
    );

    const updatedSurvey = updatedSurveys.find(survey => survey.id === newId);

    localStorage.setItem('publishedSurveys', JSON.stringify(updatedSurveys));

    if (updatedSurvey) {
      localStorage.setItem('publishedSurvey', JSON.stringify(updatedSurvey));
    }
  }

  trackByIndex(index: number) {
    return index;
  }

  getAnswerLabel(answerIndex: number) {
    return String.fromCharCode(65 + answerIndex) + '.';
  }
}
