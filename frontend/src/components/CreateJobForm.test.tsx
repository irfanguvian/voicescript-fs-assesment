import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CITIES } from '../api/cities';
import { CreateJobForm } from './CreateJobForm';

// Component integration (Testing Trophy sweet spot): drive the form the way a
// user would and assert the payload handed to onCreate, including the
// PHYSICAL-only city field.
describe('CreateJobForm', () => {
  it('hides the city field for REMOTE and shows it for PHYSICAL', () => {
    render(<CreateJobForm pending={false} onCreate={vi.fn()} />);

    expect(screen.queryByLabelText('City')).toBeNull();

    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'PHYSICAL' },
    });
    expect(screen.getByLabelText('City')).toBeInTheDocument();
  });

  it('submits a trimmed REMOTE payload with city undefined', () => {
    const onCreate = vi.fn();
    render(<CreateJobForm pending={false} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Case name'), {
      target: { value: '  Smith v Jones  ' },
    });
    fireEvent.change(screen.getByLabelText('Duration (minutes)'), {
      target: { value: '90' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create job' }));

    expect(onCreate).toHaveBeenCalledWith({
      case_name: 'Smith v Jones',
      duration_minutes: 90,
      location_type: 'REMOTE',
      city: undefined,
    });
  });

  it('offers the fixed city list as a dropdown for PHYSICAL jobs', () => {
    render(<CreateJobForm pending={false} onCreate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'PHYSICAL' },
    });
    const citySelect = screen.getByLabelText('City');
    const options = within(citySelect).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([...CITIES]);
  });

  it('submits the selected city for a PHYSICAL job', () => {
    const onCreate = vi.fn();
    render(<CreateJobForm pending={false} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Case name'), {
      target: { value: 'Doe Deposition' },
    });
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'PHYSICAL' },
    });
    fireEvent.change(screen.getByLabelText('City'), {
      target: { value: 'Surabaya' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create job' }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        location_type: 'PHYSICAL',
        city: 'Surabaya',
      }),
    );
  });
});
