import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('counter increments and resets', async () => {
  const user = userEvent.setup();
  render(<App />);

  const incBtn = screen.getByRole('button', { name: /count is/i });
  const resetBtn = screen.getByRole('button', { name: /reset/i });

  expect(incBtn).toHaveTextContent(/count is 0/i);

  await user.click(incBtn);
  expect(incBtn).toHaveTextContent(/count is 1/i);

  await user.click(resetBtn);
  expect(incBtn).toHaveTextContent(/count is 0/i);
});
