import { render, screen } from '@testing-library/react-native';
import { Badge } from '../src/components/Badge';
import { ProgressBar } from '../src/components/ProgressBar';

describe('<Badge />', () => {
  test('renders its label', async () => {
    await render(<Badge label="On track" tone="success" dot />);
    expect(screen.getByText('On track')).toBeOnTheScreen();
  });
});

describe('<ProgressBar />', () => {
  test('reports progress as a percentage, clamped to 0–100', async () => {
    await render(<ProgressBar progress={0.5} />);
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ min: 0, max: 100, now: 50 });

    await screen.rerender(<ProgressBar progress={1.4} />);
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ now: 100 });
  });
});
