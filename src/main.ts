import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Bootstraps the Angular application.
 *
 * Starts the root App component with the global application configuration.
 * Logs bootstrap errors to the console if the app cannot be started.
 */
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));