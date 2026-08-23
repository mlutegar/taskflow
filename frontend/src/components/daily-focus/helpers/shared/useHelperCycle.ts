/**
 * useHelperCycle
 *
 * Shared hook encapsulating the cycle/task-counter logic used by helpers
 * that track "N tasks per cycle, advance cycle when all tasks are done"
 * (e.g. SpliteHelper, LazyFalconHelper).
 *
 * @param {object}   state     – current helper state (must include cycle, taskInCycle)
 * @param {function} onChange  – state updater (receives full next state object)
 *
 * @returns {{ nextTask: function }}
 *   nextTask() – mark current task done; increments taskInCycle or advances cycle
 */

interface CycleState {
  cycle: number;
  taskInCycle: number;
  [key: string]: unknown;
}

export function useHelperCycle(
  state: CycleState,
  onChange: (nextState: CycleState) => void
): { nextTask: () => void } {
  const nextTask = (): void => {
    const next = state.taskInCycle + 1;
    if (next >= state.cycle) {
      onChange({ ...state, cycle: state.cycle + 1, taskInCycle: 0 });
    } else {
      onChange({ ...state, taskInCycle: next });
    }
  };

  return { nextTask };
}
