import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SurveyCard } from '../../components/survey-card/survey-card';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, SurveyCard, RouterLink, SurveyCard,  CommonModule,],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  surveys = [
    {
      category: 'Team activities',
      title: 'Let’s Plan the Next Team Event Together',
      ending: 'Ends in 1 Day',
    },

    {
      category: 'Health & Wellness',
      title: 'Fit & wellness survey!',
      ending: 'Ends in 2 Days',
    },

    {
      category: 'Gaming',
      title: 'Gaming habits and favorite games!',
      ending: 'Ends in 3 Days',
    },
  ];

  isCreateFormVisible = false;

toggleCreateForm() {
  this.isCreateFormVisible = !this.isCreateFormVisible;
}
}
