import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateSurvey } from './create-survey';

/**
 * Unit tests for the CreateSurvey component.
 */
describe('CreateSurvey', () => {
  let component: CreateSurvey;
  let fixture: ComponentFixture<CreateSurvey>;

  /**
   * Configures the Angular testing module and creates
   * a fresh CreateSurvey component instance before each test.
   */
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateSurvey],
    }).compileComponents();
    fixture = TestBed.createComponent(CreateSurvey);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  /**
   * Checks whether the CreateSurvey component can be created successfully.
   */
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});