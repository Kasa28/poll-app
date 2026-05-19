import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CreateSurveyBase } from './create-survey.base';

/**
 * Handles the survey creation flow, draft state,
 * category selection, validation, local saving, and publishing to Supabase.
 */
@Component({
  selector: 'app-create-survey',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-survey.html',
  styleUrl: './create-survey.scss',
})
export class CreateSurvey extends CreateSurveyBase {
  constructor(
    router: Router,
    cdr: ChangeDetectorRef
  ) {
    super(router, cdr);
  }
}
