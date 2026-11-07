import '@testing-library/jest-dom/vitest'

// jsdom does no layout, so it leaves this out.
Element.prototype.scrollIntoView = () => {}
