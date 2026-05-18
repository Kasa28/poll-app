import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { supabase } from '../../supabase';

type Survey = {
  id: string;
  category: string;
  title: string;
  endDate: string;
  endingLabel: string;
  sortValue: number;
  isPast: boolean;
};

type SurveyRow = {
  id: string | number;
  category: string | null;
  title: string;
  end_date: string | null;
};

type LocalSurvey = {
  id: string;
  category: string;
  title: string;
  endDate: string;
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly categories = [
    'Team Activities',
    'Health & Wellness',
    'Gaming & Entertainment',
    'Education & Learning',
    'Lifestyle & Preferences',
    'Technology & Innovation',
  ];

  surveys: Survey[] = [];
  filteredSurveys: Survey[] = [];
  endingSoonSurveys: Survey[] = [];
  loadNotice = '';
  isCategoryMenuOpen = false;
  selectedCategory = '';
  activeTab: 'active' | 'past' = 'active';

  constructor(private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    const localSurveys = this.getLocalSurveys();
    await this.loadSurveysSafely(localSurveys);
  }

  private mapSurvey(survey: SurveyRow | LocalSurvey): Survey {
    const endDate = 'end_date' in survey ? survey.end_date || '' : survey.endDate || '';
    return {
      id: String(survey.id),
      category: survey.category || 'General',
      title: survey.title,
      endDate,
      endingLabel: this.getEndingLabel(endDate),
      sortValue: this.getSortValue(endDate),
      isPast: this.isPastSurvey(endDate),
    };
  }

  private mergeSurveys(dbSurveys: Survey[], localSurveys: Survey[]) {
    const merged = new Map<string, Survey>();
    localSurveys.forEach(survey => merged.set(survey.id, survey));
    dbSurveys.forEach(survey => merged.set(survey.id, survey));
    return Array.from(merged.values()).sort((a, b) => b.sortValue - a.sortValue);
  }

  private getLocalSurveys() {
    const localSurveys: LocalSurvey[] = JSON.parse(localStorage.getItem('publishedSurveys') || '[]');
    return localSurveys.map(survey => this.mapSurvey(survey));
  }

  private loadFromLocal(localSurveys: Survey[], notice: string) {
    this.surveys = localSurveys;
    this.loadNotice = notice;
    this.updateSurveyViews();
  }

  toggleCategoryMenu() {
    this.isCategoryMenuOpen = !this.isCategoryMenuOpen;
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
    this.isCategoryMenuOpen = false;
    this.updateSurveyViews();
  }

  clearCategoryFilter() {
    this.selectedCategory = '';
    this.isCategoryMenuOpen = false;
    this.updateSurveyViews();
  }

  setActiveTab(tab: 'active' | 'past') {
    this.activeTab = tab;
    this.updateSurveyViews();
  }

  private updateSurveyViews() {
    const tabFilteredSurveys = this.surveys.filter(survey =>
      this.activeTab === 'past' ? survey.isPast : !survey.isPast
    );
    this.filteredSurveys = this.selectedCategory
      ? tabFilteredSurveys.filter(survey => survey.category === this.selectedCategory)
      : [...tabFilteredSurveys];
    this.endingSoonSurveys = [...this.surveys]
      .filter(survey => !survey.isPast)
      .sort((a, b) => a.sortValue - b.sortValue)
      .slice(0, 3);
  }

  private getEndingLabel(endDate: string) {
    const parsedDate = new Date(endDate);
    if (!endDate) return 'No end date';
    return this.isInvalidDate(parsedDate) ? `Ends on ${endDate}` : this.getRelativeEndingLabel(parsedDate);
  }

  private getSortValue(endDate: string) {
    const parsedDate = new Date(endDate);
    if (this.isInvalidDate(parsedDate)) return Number.MAX_SAFE_INTEGER;
    return parsedDate.getTime();
  }

  private isPastSurvey(endDate: string) {
    if (!endDate) return false;
    const parsedDate = new Date(endDate);
    if (this.isInvalidDate(parsedDate)) return false;
    return parsedDate.getTime() < Date.now();
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
    return Promise.race<T>([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      ),
    ]);
  }

  private fetchSurveys() {
    return this.withTimeout<{ data: SurveyRow[] | null; error: { message: string } | null }>(
      Promise.resolve(supabase.from('surveys').select('*').order('created_at', { ascending: false })),
      8000,
      'Survey list request timed out.'
    );
  }

  private handleLoadError(localSurveys: Survey[], error: { message: string }) {
    console.log('Home survey load error:', error);
    this.loadFromLocal(localSurveys, 'Database fetch failed. Showing locally saved surveys.');
  }

  private applyDatabaseSurveys(rows: SurveyRow[], localSurveys: Survey[]) {
    const dbSurveys = rows.map(survey => this.mapSurvey(survey));
    this.surveys = this.mergeSurveys(dbSurveys, localSurveys);
    this.loadNotice = '';
    this.updateSurveyViews();
  }

  private handleLoadException(localSurveys: Survey[], error: unknown) {
    console.log('Home survey load exception:', error);
    const message = error instanceof Error ? error.message : 'Survey list could not be loaded.';
    this.loadFromLocal(localSurveys, message);
  }

  private async loadInitialSurveys(localSurveys: Survey[]) {
    const result = await this.fetchSurveys();
    if (result.error) return this.handleLoadError(localSurveys, result.error);
    this.applyDatabaseSurveys(result.data || [], localSurveys);
  }

  private async loadSurveysSafely(localSurveys: Survey[]) {
    try {
      await this.loadInitialSurveys(localSurveys);
    } catch (error) {
      this.handleLoadException(localSurveys, error);
    }
    this.refreshView();
  }

  private refreshView() {
    this.cdr.detectChanges();
  }

  private getRelativeEndingLabel(parsedDate: Date) {
    const now = new Date();
    const diffMs = parsedDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffMs < 0) return 'Ended';
    if (this.isSameCalendarDay(parsedDate, now)) return 'Ends today';
    return diffDays === 1 ? 'Ends in 1 Day' : `Ends in ${diffDays} Days`;
  }

  private isSameCalendarDay(first: Date, second: Date) {
    return first.getFullYear() === second.getFullYear()
      && first.getMonth() === second.getMonth()
      && first.getDate() === second.getDate();
  }

  private isInvalidDate(date: Date) {
    return Number.isNaN(date.getTime());
  }
}
