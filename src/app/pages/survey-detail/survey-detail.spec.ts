import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SurveyDetail } from './survey-detail';

/**
 * Unit tests for the SurveyDetail component.
 */
describe('SurveyDetail', () => {
  let component: SurveyDetail;
  let fixture: ComponentFixture<SurveyDetail>;

  /**
   * Configures the Angular testing module and creates
   * a fresh SurveyDetail component instance before each test.
   */
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SurveyDetail],
    }).compileComponents();
    fixture = TestBed.createComponent(SurveyDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  /**
   * Checks whether the SurveyDetail component can be created successfully.
   */
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});