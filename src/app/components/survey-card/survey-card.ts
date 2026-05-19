import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Displays one survey preview card with category, title,
 * ending information, and a link to the survey detail page.
 */
@Component({
  selector: 'app-survey-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './survey-card.html',
  styleUrl: './survey-card.scss',
})
export class SurveyCard {
  /**
   * Unique survey id used for the survey detail route.
   */
  @Input() id = '';

  /**
   * Survey category shown on the card.
   */
  @Input() category = '';

  /**
   * Survey title shown as the main card text.
   */
  @Input() title = '';

  /**
   * User-facing ending label, for example "Ends today" or "No end date".
   */
  @Input() ending = '';
}