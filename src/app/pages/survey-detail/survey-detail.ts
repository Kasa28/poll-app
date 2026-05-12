import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

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

@Component({
  selector: 'app-survey-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './survey-detail.html',
  styleUrl: './survey-detail.scss',
})
export class SurveyDetail {
  survey: Survey = this.getSavedSurvey();

  selectedAnswers: Record<number, number[]> = {};
  votes: Record<number, Record<number, number>> = {};

  vote(questionIndex: number, answerIndex: number) {
    const selected = this.selectedAnswers[questionIndex] || [];
    const question = this.survey.questions[questionIndex];

    this.selectedAnswers[questionIndex] = question.allowMultiple
      ? this.toggleAnswer(selected, answerIndex)
      : [answerIndex];

    this.addVote(questionIndex, answerIndex);
  }

  isSelected(questionIndex: number, answerIndex: number) {
    return (this.selectedAnswers[questionIndex] || []).includes(answerIndex);
  }

  getPercentage(questionIndex: number, answerIndex: number) {
    const questionVotes = this.votes[questionIndex] || {};
    const total = Object.values(questionVotes).reduce((sum, value) => sum + value, 0);

    if (!total) {
      return 0;
    }

    return Math.round(((questionVotes[answerIndex] || 0) / total) * 100);
  }

  getAnswerLabel(answerIndex: number) {
    return this.getAnswerLetter(answerIndex) + '.';
  }

  getAnswerLetter(answerIndex: number) {
    return String.fromCharCode(65 + answerIndex);
  }

  private toggleAnswer(selected: number[], answerIndex: number) {
    return selected.includes(answerIndex)
      ? selected.filter(index => index !== answerIndex)
      : [...selected, answerIndex];
  }

  private addVote(questionIndex: number, answerIndex: number) {
    this.votes[questionIndex] ??= {};
    this.votes[questionIndex][answerIndex] ??= 0;
    this.votes[questionIndex][answerIndex]++;
  }

  private getSavedSurvey(): Survey {
    return JSON.parse(localStorage.getItem('publishedSurvey') || '{}');
  }
}