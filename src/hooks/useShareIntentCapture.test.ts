import { createElement, useEffect } from 'react';
import { useShareIntentCapture } from './useShareIntentCapture';

const { act, create } = jest.requireActual('react-test-renderer');
const mockAddItem = jest.fn();
const mockReset = jest.fn();
let mockUser: { id: string } | null;
let mockIntent: {
  hasShareIntent: boolean;
  shareIntent: { text: string; webUrl: null; files: null; type: 'text' };
  resetShareIntent: typeof mockReset;
  error: null;
};

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/hooks/useItems', () => ({ useItems: () => ({ addItem: mockAddItem }) }));
jest.mock('expo-share-intent', () => ({ useShareIntentContext: () => mockIntent }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}));

let capture: ReturnType<typeof useShareIntentCapture>;
let renderer: { update: (element: ReturnType<typeof createElement>) => void; unmount: () => void };
function Harness() {
  const value = useShareIntentCapture();
  useEffect(() => { capture = value; }, [value]);
  return null;
}

async function render() {
  await act(async () => {
    if (renderer) renderer.update(createElement(Harness));
    else renderer = create(createElement(Harness));
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.useFakeTimers();
  mockUser = { id: 'user-1' };
  mockIntent = {
    hasShareIntent: true,
    shareIntent: { text: 'A shared thought', webUrl: null, files: null, type: 'text' },
    resetShareIntent: mockReset,
    error: null,
  };
  mockReset.mockReset().mockImplementation(() => { mockIntent.hasShareIntent = false; });
  mockAddItem.mockReset().mockResolvedValue({ id: 'saved-item' });
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined!;
  jest.useRealTimers();
});

it('saves once per share and allows sharing the same content again later', async () => {
  await render();
  expect(mockAddItem).toHaveBeenCalledTimes(1);
  expect(mockReset).toHaveBeenCalledTimes(1);
  await render();
  mockIntent.hasShareIntent = true;
  await render();
  expect(mockAddItem).toHaveBeenCalledTimes(2);
});

it('keeps a failed share available until a successful retry', async () => {
  mockAddItem.mockRejectedValueOnce(new Error('Network unavailable'));
  await render();
  expect(capture.status).toBe('error');
  expect(mockReset).not.toHaveBeenCalled();
  await act(async () => capture.retry());
  expect(capture.status).toBe('saved');
  expect(mockReset).toHaveBeenCalledTimes(1);
});

it('holds a share through sign-in instead of acknowledging an unsaved item', async () => {
  mockUser = null;
  await render();
  expect(capture.waitingForSignIn).toBe(true);
  expect(mockAddItem).not.toHaveBeenCalled();
  expect(mockReset).not.toHaveBeenCalled();
  mockUser = { id: 'user-1' };
  await render();
  expect(mockAddItem).toHaveBeenCalledTimes(1);
});

it('does not clear a newer share when an older save finishes', async () => {
  let finishFirst!: (value: { id: string }) => void;
  mockAddItem.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
  await render();
  mockIntent.shareIntent = { ...mockIntent.shareIntent, text: 'A second thought' };
  await render();
  expect(mockAddItem).toHaveBeenCalledTimes(1);
  await act(async () => finishFirst({ id: 'first' }));
  expect(mockAddItem.mock.calls.map(args => args[0])).toEqual(['A shared thought', 'A second thought']);
  expect(mockReset).toHaveBeenCalledTimes(1);
});
