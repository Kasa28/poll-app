import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SurveyCard } from './survey-card';

/**
 * Unit tests for the SurveyCard component.
 */
describe('SurveyCard', () => {
  let component: SurveyCard;
  let fixture: ComponentFixture<SurveyCard>;

  /**
   * Configures the Angular testing module and creates
   * a fresh SurveyCard component instance before each test.
   */
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SurveyCard],
    }).compileComponents();
    fixture = TestBed.createComponent(SurveyCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  /**
   * Checks whether the SurveyCard component can be created successfully.
   */
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});