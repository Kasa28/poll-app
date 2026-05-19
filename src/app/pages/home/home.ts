import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../../supabase';

/**
 * Normalized survey card data used by the home page lists.
 */
type Survey = {
  id: string;
  category: string;
  title: string;
  endDate: string;
  endingLabel: string;
  sortValue: number;
  isPast: boolean;
};

/**
 * Raw survey row returned by Supabase on the home page.
 */
type SurveyRow = {
  id: string | number;
  category: string | null;
  title: string;
  end_date: string | null;
};

/**
 * Local fallback survey shape stored in localStorage.
 */
type LocalSurvey = {
  id: string;
  category: string;
  title: string;
  endDate: string;
};

/**
 * Loads surveys, builds the home page survey lists,
 * and manages filters for category and active/past tabs.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly voteCooldownMs = 3000;
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
  cooldownNotice = '';
  isCategoryMenuOpen = false;
  selectedCategory = '';
  activeTab: 'active' | 'past' = 'active';

  /**
   * Creates the home page component.
   *
   * @param cdr Angular change detector used to refresh the view after async loading.
   * @param router Angular router used to open survey detail pages.
   */
  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  /**
   * Loads local fallback surveys and then tries to load surveys from Supabase.
   *
   * @returns A promise that resolves when the initial loading flow is finished.
   */
  async ngOnInit() {
    const localSurveys = this.getLocalSurveys();
    await this.loadSurveysSafely(localSurveys);
  }

  /**
   * Maps a database or local survey into the normalized card model.
   *
   * @param survey Survey data from Supabase or localStorage.
   * @returns A normalized survey object for the home page.
   */
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

  /**
   * Merges database surveys with local fallback surveys.
   * Database surveys overwrite local surveys with the same id.
   *
   * @param dbSurveys Surveys loaded from Supabase.
   * @param localSurveys Surveys loaded from localStorage.
   * @returns A merged and sorted survey list.
   */
  private mergeSurveys(dbSurveys: Survey[], localSurveys: Survey[]) {
    const merged = new Map<string, Survey>();
    localSurveys.forEach(survey => merged.set(survey.id, survey));
    dbSurveys.forEach(survey => merged.set(survey.id, survey));
    return Array.from(merged.values()).sort((a, b) => b.sortValue - a.sortValue);
  }

  /**
   * Reads locally stored published surveys.
   *
   * @returns A normalized list of locally saved surveys.
   */
  private getLocalSurveys() {
    const localSurveys: LocalSurvey[] = JSON.parse(localStorage.getItem('publishedSurveys') || '[]');
    return localSurveys.map(survey => this.mapSurvey(survey));
  }

  /**
   * Applies local-only survey data and shows a load notice.
   *
   * @param localSurveys Local fallback surveys.
   * @param notice Message shown when remote data cannot be loaded.
   */
  private loadFromLocal(localSurveys: Survey[], notice: string) {
    this.surveys = localSurveys;
    this.loadNotice = notice;
    this.updateSurveyViews();
  }

  /**
   * Opens or closes the category dropdown menu.
   */
  toggleCategoryMenu() {
    this.isCategoryMenuOpen = !this.isCategoryMenuOpen;
  }

  /**
   * Applies a category filter to the survey list.
   *
   * @param category Selected category name.
   */
  selectCategory(category: string) {
    this.selectedCategory = category;
    this.isCategoryMenuOpen = false;
    this.updateSurveyViews();
  }

  /**
   * Removes the active category filter.
   */
  clearCategoryFilter() {
    this.selectedCategory = '';
    this.isCategoryMenuOpen = false;
    this.updateSurveyViews();
  }

  /**
   * Switches between active and past survey lists.
   *
   * @param tab Selected survey tab.
   */
  setActiveTab(tab: 'active' | 'past') {
    this.activeTab = tab;
    this.updateSurveyViews();
  }

  /**
   * Opens one survey unless a short post-vote cooldown is still active.
   *
   * @param surveyId Survey id to open.
   * @param event Click event from the survey card.
   */
  openSurvey(surveyId: string, event: Event) {
    event.preventDefault();
    if (!this.isVoteCooldownActive(surveyId)) {
      this.cooldownNotice = '';
      void this.router.navigate(['/survey', surveyId]);
      return;
    }

    this.cooldownNotice = 'Please wait 3 seconds before opening this survey again.';
    const remainingMs = this.getVoteCooldownRemainingMs(surveyId);
    window.setTimeout(() => {
      if (!this.isVoteCooldownActive(surveyId)) {
        this.cooldownNotice = '';
        this.refreshView();
      }
    }, remainingMs);
  }

  /**
   * Rebuilds the visible survey lists based on the active tab and category filter.
   */
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

  /**
   * Builds the label displayed for a survey end date.
   *
   * @param endDate Survey end date as a string.
   * @returns A user-facing ending label.
   */
  private getEndingLabel(endDate: string) {
    const parsedDate = new Date(endDate);
    if (!endDate) return 'No end date';
    return this.isInvalidDate(parsedDate)
      ? `Ends on ${endDate}`
      : this.getRelativeEndingLabel(parsedDate);
  }

  /**
   * Converts an end date into a sortable timestamp.
   *
   * @param endDate Survey end date as a string.
   * @returns A timestamp used for sorting.
   */
  private getSortValue(endDate: string) {
    const parsedDate = new Date(endDate);
    if (this.isInvalidDate(parsedDate)) return Number.MAX_SAFE_INTEGER;
    return parsedDate.getTime();
  }

  /**
   * Checks whether a survey end date is already in the past.
   *
   * @param endDate Survey end date as a string.
   * @returns True if the survey is past, otherwise false.
   */
  private isPastSurvey(endDate: string) {
    if (!endDate) return false;
    const parsedDate = new Date(endDate);
    if (this.isInvalidDate(parsedDate)) return false;
    return parsedDate.getTime() < Date.now();
  }

  /**
   * Wraps a promise with a timeout guard.
   *
   * @template T Promise result type.
   * @param promise Promise that should be guarded.
   * @param timeoutMs Timeout duration in milliseconds.
   * @param message Error message used when the timeout is reached.
   * @returns The original promise result or a rejected timeout error.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
    return Promise.race<T>([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      ),
    ]);
  }

  /**
   * Requests the survey list from Supabase.
   *
   * @returns A promise with Supabase survey rows or an error object.
   */
  private fetchSurveys() {
    return this.withTimeout<{ data: SurveyRow[] | null; error: { message: string } | null }>(
      Promise.resolve(supabase.from('surveys').select('*').order('created_at', { ascending: false })),
      8000,
      'Survey list request timed out.'
    );
  }

  /**
   * Handles database loading errors and falls back to local surveys.
   *
   * @param localSurveys Local fallback surveys.
   * @param error Supabase error object.
   */
  private handleLoadError(localSurveys: Survey[], error: { message: string }) {
    console.log('Home survey load error:', error);
    this.loadFromLocal(localSurveys, 'Database fetch failed. Showing locally saved surveys.');
  }

  /**
   * Stores normalized database surveys and updates all visible survey lists.
   *
   * @param rows Raw survey rows loaded from Supabase.
   * @param localSurveys Local fallback surveys.
   */
  private applyDatabaseSurveys(rows: SurveyRow[], localSurveys: Survey[]) {
    const dbSurveys = rows.map(survey => this.mapSurvey(survey));
    this.surveys = this.mergeSurveys(dbSurveys, localSurveys);
    this.loadNotice = '';
    this.updateSurveyViews();
  }

  /**
   * Handles unexpected errors during the survey loading flow.
   *
   * @param localSurveys Local fallback surveys.
   * @param error Unknown thrown error.
   */
  private handleLoadException(localSurveys: Survey[], error: unknown) {
    console.log('Home survey load exception:', error);
    const message = error instanceof Error
      ? error.message
      : 'Survey list could not be loaded.';
    this.loadFromLocal(localSurveys, message);
  }

  /**
   * Loads the initial survey list from Supabase.
   *
   * @param localSurveys Local fallback surveys used when loading fails.
   * @returns A promise that resolves when the load attempt is finished.
   */
  private async loadInitialSurveys(localSurveys: Survey[]) {
    const result = await this.fetchSurveys();
    if (result.error) return this.handleLoadError(localSurveys, result.error);
    this.applyDatabaseSurveys(result.data || [], localSurveys);
  }

  /**
   * Runs the full survey loading flow and refreshes the view afterwards.
   *
   * @param localSurveys Local fallback surveys.
   * @returns A promise that resolves when loading and refreshing are finished.
   */
  private async loadSurveysSafely(localSurveys: Survey[]) {
    try {
      await this.loadInitialSurveys(localSurveys);
    } catch (error) {
      this.handleLoadException(localSurveys, error);
    }
    this.refreshView();
  }

  /**
   * Forces Angular to refresh the home page after async work.
   */
  private refreshView() {
    this.cdr.detectChanges();
  }

  /**
   * Checks whether the short post-vote cooldown is still active.
   *
   * @param surveyId Survey id to check.
   * @returns True while the cooldown is active.
   */
  private isVoteCooldownActive(surveyId: string) {
    return this.getVoteCooldownRemainingMs(surveyId) > 0;
  }

  /**
   * Returns the remaining cooldown time in milliseconds.
   *
   * @param surveyId Survey id to check.
   * @returns Remaining cooldown time or zero.
   */
  private getVoteCooldownRemainingMs(surveyId: string) {
    const cooldownUntil = Number(localStorage.getItem(this.getVoteCooldownKey(surveyId)) || 0);
    return Math.max(0, cooldownUntil - Date.now());
  }

  /**
   * Builds the localStorage key used for the short post-vote cooldown.
   *
   * @param surveyId Survey id to namespace the key.
   * @returns localStorage key for one survey cooldown.
   */
  private getVoteCooldownKey(surveyId: string) {
    return `pollapp-vote-cooldown-${surveyId}`;
  }

  /**
   * Converts a date into a relative ending label.
   *
   * @param parsedDate Parsed survey end date.
   * @returns A relative label such as "Ends today" or "Ends in 2 Days".
   */
  private getRelativeEndingLabel(parsedDate: Date) {
    const now = new Date();
    const diffMs = parsedDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffMs < 0) return 'Ended';
    if (this.isSameCalendarDay(parsedDate, now)) return 'Ends today';
    return diffDays === 1 ? 'Ends in 1 Day' : `Ends in ${diffDays} Days`;
  }

  /**
   * Checks whether two dates are on the same calendar day.
   *
   * @param first First date.
   * @param second Second date.
   * @returns True if both dates share the same year, month, and day.
   */
  private isSameCalendarDay(first: Date, second: Date) {
    return first.getFullYear() === second.getFullYear()
      && first.getMonth() === second.getMonth()
      && first.getDate() === second.getDate();
  }

  /**
   * Checks whether a date object is invalid.
   *
   * @param date Date object to validate.
   * @returns True if the date cannot be parsed correctly.
   */
  private isInvalidDate(date: Date) {
    return Number.isNaN(date.getTime());
  }
}
