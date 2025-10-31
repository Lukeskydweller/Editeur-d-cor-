import { create } from 'zustand';
import { produce } from 'immer';

type State = { count: number };
type Actions = {
  inc: () => void;
  reset: () => void;
};

export const useCounter = create<State & Actions>((set) => ({
  count: 0,
  inc: () =>
    set(
      produce((draft: State) => {
        draft.count += 1;
      }),
    ),
  reset: () =>
    set(
      produce((draft: State) => {
        draft.count = 0;
      }),
    ),
}));
