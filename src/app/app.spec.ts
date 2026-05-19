import { TestBed } from '@angular/core/testing';
import { App } from './app';

/**
 * Unit tests for the root App component.
 */
describe('App', () => {
  /**
   * Configures the Angular testing module before each test.
   */
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  /**
   * Checks whether the App component can be created successfully.
   */
  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app).toBeTruthy();
  });

  /**
   * Checks whether the expected title is rendered in the template.
   */
  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, poll-app');
  });
});