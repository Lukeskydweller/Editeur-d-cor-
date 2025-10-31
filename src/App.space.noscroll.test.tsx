import { render } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';

beforeEach(() => {
  useSceneStore.setState({
    scene: {
      id: 'test',
      createdAt: new Date().toISOString(),
      size: { w: 600, h: 600 },
      materials: {},
      layers: {},
      pieces: {},
      layerOrder: [],
    },
    ui: {
      selectedId: undefined,
      selectedIds: undefined,
      primaryId: undefined,
      flashInvalidAt: undefined,
      dragging: undefined,
      marquee: undefined,
      snap10mm: true,
      guides: undefined,
    },
  });
});

test('Space key prevents page scroll', () => {
  render(<App />);

  // Create a Space keydown event
  const event = new KeyboardEvent('keydown', {
    code: 'Space',
    key: ' ',
    bubbles: true,
    cancelable: true,
  });

  const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

  // Dispatch the event
  window.dispatchEvent(event);

  // Verify preventDefault was called
  expect(preventDefaultSpy).toHaveBeenCalled();
});

test('Space key with modifiers still prevents scroll', () => {
  render(<App />);

  const event = new KeyboardEvent('keydown', {
    code: 'Space',
    key: ' ',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });

  const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

  window.dispatchEvent(event);

  expect(preventDefaultSpy).toHaveBeenCalled();
});
