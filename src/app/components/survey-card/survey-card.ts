import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-survey-card',
  standalone: true,
  imports: [],
  templateUrl: './survey-card.html',
  styleUrl: './survey-card.scss',
})
export class SurveyCard {
  @Input() category = '';
  @Input() title = '';
  @Input() ending = '';
}
