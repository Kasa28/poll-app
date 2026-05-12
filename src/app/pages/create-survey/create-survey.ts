import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

type QuestionBlock = {
  text: string;
  allowMultiple: boolean;
  answers: string[];
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

  publishSurvey() {
  const survey = {
    id: Date.now().toString(),
    title: this.surveyTitle || 'Created survey',
    description: this.surveyDescription,
    endDate: this.surveyEndDate,
    category: this.selectedCategory || 'General',
    questions: this.questions,
  };

  localStorage.setItem('publishedSurvey', JSON.stringify(survey));

  this.router.navigate(['/survey', survey.id]);
}

  trackByIndex(index: number) {
    return index;
  }

  getAnswerLabel(answerIndex: number) {
    return String.fromCharCode(65 + answerIndex) + '.';
  }
}