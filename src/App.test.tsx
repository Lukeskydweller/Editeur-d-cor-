import { render, screen } from '@testing-library/react';
import App from './App';

test('renders svg canvas with one rect piece', () => {
  render(<App />);

  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  expect(canvas).toBeInTheDocument();

  const heading = screen.getByRole('heading', { name: /Éditeur — Mini smoke/i });
  expect(heading).toBeInTheDocument();

  expect(screen.getByText(/1 pièce\(s\)/i)).toBeInTheDocument();
});
