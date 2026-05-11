import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SurveyCard } from './survey-card';

describe('SurveyCard', () => {
  let component: SurveyCard;
  let fixture: ComponentFixture<SurveyCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SurveyCard],
    }).compileComponents();

    fixture = TestBed.createComponent(SurveyCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
