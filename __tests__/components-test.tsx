import { fireEvent, render, screen } from '@testing-library/react-native';
import { Badge } from '../src/components/Badge';
import { CodeBoxes, CodeDigits, nextCode } from '../src/components/CodeBoxes';
import { ProgressBar } from '../src/components/ProgressBar';
import { activeCoverInr } from '../src/booking/walkCover';

describe('activeCoverInr', () => {
  test('shows an amount only from the booking’s own active insurance', () => {
    expect(activeCoverInr({ id: 'b1', insurance: { active: true, coverInr: 25000 } })).toBe(25000);
    // Not switched on yet (no doorstep check), no insurance, or no server booking: no amount at all.
    expect(activeCoverInr({ id: 'b1', insurance: { active: false, coverInr: 25000 } })).toBeNull();
    expect(activeCoverInr({ id: 'b1', insurance: null })).toBeNull();
    expect(activeCoverInr({ id: 'b1' })).toBeNull();
    expect(activeCoverInr(undefined)).toBeNull();
  });
});

describe('<Badge />', () => {
  test('renders its label', async () => {
    await render(<Badge label="On track" tone="success" dot />);
    expect(screen.getByText('On track')).toBeOnTheScreen();
  });
});

describe('<CodeBoxes />', () => {
  test('one labelled input drives the boxes and passes on digits only', async () => {
    const onChangeText = jest.fn();
    await render(<CodeBoxes value="12" onChangeText={onChangeText} length={6} accessibilityLabel="6-digit code" />);
    const input = screen.getByLabelText('6-digit code');
    expect(input.props.value).toBe('12');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.autoComplete).toBe('sms-otp');
    // The boxes mirror the input; screen readers get the input alone.
    expect(screen.queryByText('1')).toBeNull();
    expect(screen.getByText('1', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeOnTheScreen();

    // A pasted or autofilled code with spaces still fills all six boxes.
    await fireEvent.changeText(input, '123 456');
    expect(onChangeText).toHaveBeenLastCalledWith('123456');
  });

  test('extra input never grows the code past its length', () => {
    expect(nextCode('1234567', '123456', 6)).toBe('123456'); // one more key: ignored
    expect(nextCode('123456987654', '123456', 6)).toBe('987654'); // a paste over a full code replaces it
    expect(nextCode('12a3', '12', 6)).toBe('123');
  });

  test('a code to read out is one element with its label', async () => {
    await render(<CodeDigits value="7391" length={4} size="lg" accessibilityLabel="One-time code 7 3 9 1" />);
    expect(screen.getByLabelText('One-time code 7 3 9 1')).toBeOnTheScreen();
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
