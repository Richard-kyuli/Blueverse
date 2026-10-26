import '@testing-library/jest-dom';

// jsdom does not implement scrolling. Chat-style components call scrollIntoView
// after rendering a message list, so give them a no-op instead of throwing.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
