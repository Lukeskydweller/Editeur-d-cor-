import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShapeLibrary from '../../src/components/ShapeLibrary';
import { useSceneStore } from '../../src/state/useSceneStore';

describe('ShapeLibrary - UI Component', () => {
  beforeEach(() => {
    // Reset store to a clean state
    const store = useSceneStore.getState();
    store.initScene(600, 600);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });
    // Clear all spies
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Ensure spies are cleaned up
    vi.restoreAllMocks();
  });

  describe('Input tolerance and validation', () => {
    it('accepts empty string during typing', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: '' } });

      expect(widthInput.value).toBe('');
    });

    it('accepts "0" during typing', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: '0' } });

      expect(widthInput.value).toBe('0');
    });

    it('accepts digit-only strings during typing', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: '123' } });

      expect(widthInput.value).toBe('123');
    });

    it('rejects non-digit strings during typing', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: 'abc' } });

      expect(widthInput.value).toBe('60'); // Should keep previous value
    });

    it('clamps to minimum 5mm on blur when value is empty', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: '' } });
      fireEvent.blur(widthInput);

      expect(widthInput.value).toBe('5');
    });

    it('clamps to minimum 5mm on blur when value is 0', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: '0' } });
      fireEvent.blur(widthInput);

      expect(widthInput.value).toBe('5');
    });

    it('clamps to minimum 5mm on blur when value is less than 5', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: '3' } });
      fireEvent.blur(widthInput);

      expect(widthInput.value).toBe('5');
    });

    it('clamps to scene max on blur when value exceeds scene size', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: '1000' } });
      fireEvent.blur(widthInput);

      expect(widthInput.value).toBe('600'); // Scene width is 600
    });
  });

  describe('Enter key support', () => {
    it('triggers insertion when Enter pressed in width input', async () => {
      const insertRectSpy = vi.spyOn(useSceneStore.getState(), 'insertRect');

      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.change(widthInput, { target: { value: '100' } });
      fireEvent.keyDown(widthInput, { key: 'Enter' });

      expect(insertRectSpy).toHaveBeenCalled();
    });

    it('triggers insertion when Enter pressed in height input', async () => {
      const insertRectSpy = vi.spyOn(useSceneStore.getState(), 'insertRect');

      render(<ShapeLibrary />);
      const heightInput = screen.getByTestId('custom-height') as HTMLInputElement;

      fireEvent.change(heightInput, { target: { value: '100' } });
      fireEvent.keyDown(heightInput, { key: 'Enter' });

      expect(insertRectSpy).toHaveBeenCalled();
    });

    it('does not trigger insertion when other keys are pressed', () => {
      const insertRectSpy = vi.spyOn(useSceneStore.getState(), 'insertRect');

      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;

      fireEvent.keyDown(widthInput, { key: 'a' });

      expect(insertRectSpy).not.toHaveBeenCalled();
    });
  });

  describe('Insert button state', () => {
    it('disables insert button when width is less than 5', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;
      const insertButton = screen.getByTestId('custom-insert') as HTMLButtonElement;

      fireEvent.change(widthInput, { target: { value: '3' } });

      expect(insertButton.disabled).toBe(true);
    });

    it('disables insert button when height is less than 5', () => {
      render(<ShapeLibrary />);
      const heightInput = screen.getByTestId('custom-height') as HTMLInputElement;
      const insertButton = screen.getByTestId('custom-insert') as HTMLButtonElement;

      fireEvent.change(heightInput, { target: { value: '2' } });

      expect(insertButton.disabled).toBe(true);
    });

    it('disables insert button when width is empty', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;
      const insertButton = screen.getByTestId('custom-insert') as HTMLButtonElement;

      fireEvent.change(widthInput, { target: { value: '' } });

      expect(insertButton.disabled).toBe(true);
    });

    it('enables insert button when both dimensions are valid', () => {
      render(<ShapeLibrary />);
      const widthInput = screen.getByTestId('custom-width') as HTMLInputElement;
      const heightInput = screen.getByTestId('custom-height') as HTMLInputElement;
      const insertButton = screen.getByTestId('custom-insert') as HTMLButtonElement;

      fireEvent.change(widthInput, { target: { value: '100' } });
      fireEvent.change(heightInput, { target: { value: '100' } });

      expect(insertButton.disabled).toBe(false);
    });
  });
});
