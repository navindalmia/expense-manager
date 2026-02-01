/**
 * Minimal ExpenseListScreen tests
 * Tests component behavior: button exists, API is called with correct params
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import axios from 'axios';

vi.mock('axios');

describe('ExpenseListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ✅ TEST: Button exists and is clickable
  it('should render Load button', () => {
    render(<ExpenseListScreen />);
    expect(screen.getByRole('button', { name: /load/i })).toBeInTheDocument();
  });

  // ✅ TEST: Component calls correct API endpoint with Accept-Language header
  it('should call /api/expenses with Accept-Language header', () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    
    render(<ExpenseListScreen />);
    fireEvent.click(screen.getByRole('button'));
    
    expect(axios.get).toHaveBeenCalledWith(
      '/api/expenses',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Accept-Language': expect.any(String),
        }),
      })
    );
  });
});
