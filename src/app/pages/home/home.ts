import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SurveyCard } from '../../components/survey-card/survey-card';

type Survey = {
  id: string;
  category: string;
  title: string;
  endDate: string;
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, SurveyCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  surveys: Survey[] = JSON.parse(
    localStorage.getItem('publishedSurveys') || '[]'
  );
}