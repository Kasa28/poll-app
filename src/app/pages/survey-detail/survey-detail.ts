import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SurveyDetailBase } from './survey-detail.base';

/**
 * Displays one survey detail page, handles answer selection,
 * saves votes, loads stored vote counts, and renders live results.
 */
@Component({
  selector: 'app-survey-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './survey-detail.html',
  styleUrl: './survey-detail.scss',
})
export class SurveyDetail extends SurveyDetailBase {
  constructor(
    route: ActivatedRoute,
    router: Router,
    cdr: ChangeDetectorRef
  ) {
    super(route, router, cdr);
  }
}
