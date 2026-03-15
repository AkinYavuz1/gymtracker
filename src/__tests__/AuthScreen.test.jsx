import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock supabase module
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null }) }),
  },
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn().mockResolvedValue(null),
  getProfile: vi.fn().mockResolvedValue(null),
  updateProfile: vi.fn(),
  getTemplates: vi.fn().mockResolvedValue([]),
  getWorkouts: vi.fn().mockResolvedValue([]),
  getPersonalRecords: vi.fn().mockResolvedValue([]),
  getVolumeTrend: vi.fn().mockResolvedValue([]),
  seedDummyData: vi.fn(),
  callCoachAPI: vi.fn(),
}));

vi.mock('../lib/offlineStorage', () => ({
  getPendingCount: vi.fn().mockReturnValue(0),
  syncPendingWorkouts: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  queueWorkout: vi.fn(),
}));

vi.mock('../lib/exerciseGifs', () => ({
  getExerciseGif: vi.fn().mockResolvedValue(null),
}));

import App from '../App';
import { signUp, signIn, getSession } from '../lib/supabase';

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(null);
  });

  it('renders login form by default', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('gAIns')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('does not show name field in login mode', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('gAIns')).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText('Full Name')).not.toBeInTheDocument();
  });

  it('switches to signup mode and shows name field', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Sign Up'));
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
  });

  it('switches back to login mode', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Sign Up'));
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sign In'));
    expect(screen.queryByPlaceholderText('Full Name')).not.toBeInTheDocument();
  });

  it('shows error message on login failure', async () => {
    signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
  });

  it('shows error message on signup failure', async () => {
    signUp.mockResolvedValue({ error: { message: 'Email already exists' } });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });

    // Switch to signup
    fireEvent.click(screen.getByText('Sign Up'));
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass123' } });

    // Find the submit button (it says "Sign Up" in signup mode)
    const submitBtn = screen.getAllByText('Sign Up').find(el => el.tagName === 'BUTTON' && el.type === 'submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });

  it('calls signIn with correct parameters', async () => {
    signIn.mockResolvedValue({ error: null });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'mypass' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('user@test.com', 'mypass');
    });
  });

  it('calls signUp with name, email, and password', async () => {
    signUp.mockResolvedValue({ error: null });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sign Up'));
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'jane@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'securepass' } });

    const submitBtn = screen.getAllByText('Sign Up').find(el => el.tagName === 'BUTTON' && el.type === 'submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith('jane@test.com', 'securepass', 'Jane Doe');
    });
  });

  it('disables inputs while loading', async () => {
    // Make signIn hang so we can check loading state
    signIn.mockImplementation(() => new Promise(() => {}));

    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeDisabled();
      expect(screen.getByPlaceholderText('Password')).toBeDisabled();
    });
  });

  it('clears error when switching modes', async () => {
    signIn.mockResolvedValue({ error: { message: 'Bad login' } });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    // Trigger error
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Bad login')).toBeInTheDocument();
    });

    // Switch mode should clear error
    fireEvent.click(screen.getByText('Sign Up'));
    expect(screen.queryByText('Bad login')).not.toBeInTheDocument();
  });

  it('shows subtitle text', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('AI-powered strength training')).toBeInTheDocument();
    });
  });
});
