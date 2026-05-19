import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { CreateSurvey } from './pages/create-survey/create-survey';
import { SurveyDetail } from './pages/survey-detail/survey-detail';

/**
 * Application route configuration.
 *
 * Defines the available page routes for the home page,
 * survey creation page, and survey detail page.
 */
export const routes: Routes = [
  {
    path: '',
    component: Home,
  },

  {
    path: 'create',
    component: CreateSurvey,
  },

  {
    path: 'survey/:id',
    component: SurveyDetail,
  },
];