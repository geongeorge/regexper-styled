// let regexper = new Regexper(document.body);

// let myrg = "/^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/";

// regexper.showExpression(myrg);


// The Regexper class manages the top-level behavior for the entire
// application. This includes event handlers for all user interactions.
//this.showExpression(this.field.value);
import util from './util.js';
import Parser from './parser/javascript.js';
import _ from 'lodash';

export default class Regexper {
  constructor(root) {
    this.root = root;
    this.form = root.querySelector('#regexp-form');
    this.field = root.querySelector('#regexp-input');
    this.error = root.querySelector('#error');
    this.warnings = root.querySelector('#warnings');

    this.svgContainer = root.querySelector('#regexp-render');
  }

  // bindListeners() {
  //   this.form.addEventListener('submit', this.submitListener.bind(this));
  // }
  // submitListener(event) {
  //   event.returnValue = false;
  //   if (event.preventDefault) {
  //     event.preventDefault();
  //   }

  //   this.permalinkEnabled = false;
  //   this.showExpression(this.field.value);
  // }


  set state(state) {
    this.root.className = state;
  }

  get state() {
    return this.root.className;
  }

  // Start the rendering of a regular expression.
  //
  // - __expression__ - Regular expression to display.
  showExpression(expression) {
    this.field.value = expression;
    this.state = '';

    if (expression !== '') {
      this.renderRegexp(expression).catch(util.exposeError);
    }
  }


  // Display any warnings that were generated while rendering a regular expression.
  //
  // - __warnings__ - Array of warning messages to display.
  displayWarnings(warnings) {
    this.warnings.innerHTML = _.map(warnings, warning => (
      `<li class="warning-item">${warning}</li>`
    )).join('');
  }

  // Render regular expression
  //
  // - __expression__ - Regular expression to render
  renderRegexp(expression) {
    let parseError = false,
        startTime, endTime;

    // When a render is already in progress, cancel it and try rendering again
    // after a short delay (canceling a render is not instantaneous).
    if (this.running) {
      this.running.cancel();

      return util.wait(10).then(() => this.renderRegexp(expression));
    }

    this.state = 'is-loading';
    startTime = new Date().getTime();

    this.running = new Parser(this.svgContainer);

    return this.running
      // Parse the expression.
      .parse(expression)
      // Display any error messages from the parser and abort the render.
      .catch(message => {
        this.state = 'has-error';
        this.error.innerHTML = '';
        this.error.appendChild(document.createTextNode(message));

        parseError = true;

        throw message;
      })
      // When parsing is successful, render the parsed expression.
      .then(parser => parser.render())
      // Once rendering is complete:
      //  - Update links
      //  - Display any warnings
      //  - Track the completion of the render and how long it took
      .then(() => {
        this.state = 'has-results';
        // this.updateLinks();
        this.displayWarnings(this.running.warnings);
        util.track('send', 'event', 'visualization', 'complete');

        endTime = new Date().getTime();
        util.track('send', 'timing', 'visualization', 'total time', endTime - startTime);
      })
      // Handle any errors that happened during the rendering pipeline.
      // Swallows parse errors and render cancellations. Any other exceptions
      // are allowed to continue on to be tracked by the global error handler.
      .catch(message => {
        if (message === 'Render cancelled') {
          util.track('send', 'event', 'visualization', 'cancelled');
          this.state = '';
        } else if (parseError) {
          util.track('send', 'event', 'visualization', 'parse error');
        } else {
          throw message;
        }
      })
      // Finally, mark rendering as complete (and pass along any exceptions
      // that were thrown).
      .then(
        () => {
          this.running = false;
        },
        message => {
          this.running = false;
          throw message;
        }
      );
  }
}
