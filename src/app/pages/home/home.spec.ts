import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Home } from './home';

/**
 * Unit tests for the Home component.
 */
describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  /**
   * Configures the Angular testing module and creates
   * a fresh Home component instance before each test.
   */
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
    }).compileComponents();
    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  /**
   * Checks whether the Home component can be created successfully.
   */
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});