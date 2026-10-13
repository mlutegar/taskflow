import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import DailyTimer from './DailyTimer';
import type { DailyFocusLive } from '../../../lib/dailyFocusLive';

describe('DailyTimer - Cronômetro Persistente', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve calcular tempo correto via snapshot ao invés de decrementar contador', () => {
    const now = Date.now();
    const snapshot: DailyFocusLive = {
      taskTitle: 'Tarefa Teste',
      phase: 'work',
      running: true,
      remainingSecs: 300, // 5 minutos
      anchorTs: now,
      totalSecs: 600,
      rushMode: false,
      tabMode: false,
      cycleCount: 0,
      nextTaskTitle: '',
      taskIndex: 0,
      taskCount: 1,
    };

    render(
      <DailyTimer
        totalSeconds={600}
        snapshot={snapshot}
        onTick={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Deve mostrar 5:00 inicialmente
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('deve compensar tempo transcorrido mesmo sem setInterval ativo', () => {
    const now = Date.now();
    const snapshot: DailyFocusLive = {
      taskTitle: 'Tarefa Teste',
      phase: 'work',
      running: true,
      remainingSecs: 300, // 5 minutos quando snapshot foi criado
      anchorTs: now - 120000, // Mas snapshot foi criado há 2 minutos (120s)
      totalSecs: 600,
      rushMode: false,
      tabMode: false,
      cycleCount: 0,
      nextTaskTitle: '',
      taskIndex: 0,
      taskCount: 1,
    };

    render(
      <DailyTimer
        totalSeconds={600}
        snapshot={snapshot}
        onTick={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Deve mostrar 3:00 (5min - 2min transcorridos)
    expect(screen.getByText('03:00')).toBeInTheDocument();
  });

  it('deve congelar tempo quando pausado', () => {
    const now = Date.now();
    const snapshot: DailyFocusLive = {
      taskTitle: 'Tarefa Teste',
      phase: 'work',
      running: false, // PAUSADO
      remainingSecs: 180, // 3 minutos congelados
      anchorTs: now - 300000, // Snapshot de 5 minutos atrás (mas pausado)
      totalSecs: 600,
      rushMode: false,
      tabMode: false,
      cycleCount: 0,
      nextTaskTitle: '',
      taskIndex: 0,
      taskCount: 1,
    };

    render(
      <DailyTimer
        totalSeconds={600}
        snapshot={snapshot}
        onTick={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Deve mostrar 3:00 (tempo congelado, não desconta os 5min do anchorTs)
    expect(screen.getByText('03:00')).toBeInTheDocument();
    expect(screen.getByText('pausado')).toBeInTheDocument();
  });

  it('deve chamar onComplete quando tempo acabar', () => {
    const now = Date.now();
    const onComplete = vi.fn();
    const snapshot: DailyFocusLive = {
      taskTitle: 'Tarefa Teste',
      phase: 'work',
      running: true,
      remainingSecs: 2, // 2 segundos restantes
      anchorTs: now,
      totalSecs: 600,
      rushMode: false,
      tabMode: false,
      cycleCount: 0,
      nextTaskTitle: '',
      taskIndex: 0,
      taskCount: 1,
    };

    render(
      <DailyTimer
        totalSeconds={600}
        snapshot={snapshot}
        onTick={vi.fn()}
        onComplete={onComplete}
      />
    );

    // Avança 3 segundos (timer deve completar)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).toHaveBeenCalled();
    expect(screen.getByText('pronto!')).toBeInTheDocument();
  });

  it('deve detectar conclusão automática ao montar se tempo já acabou', () => {
    const now = Date.now();
    const onComplete = vi.fn();
    const snapshot: DailyFocusLive = {
      taskTitle: 'Tarefa Teste',
      phase: 'work',
      running: true,
      remainingSecs: 300, // 5 minutos quando criado
      anchorTs: now - 360000, // Mas foi criado há 6 minutos (360s) — tempo acabou!
      totalSecs: 600,
      rushMode: false,
      tabMode: false,
      cycleCount: 0,
      nextTaskTitle: '',
      taskIndex: 0,
      taskCount: 1,
    };

    render(
      <DailyTimer
        totalSeconds={600}
        snapshot={snapshot}
        onTick={vi.fn()}
        onComplete={onComplete}
      />
    );

    // Deve mostrar 00:00 imediatamente
    expect(screen.getByText('00:00')).toBeInTheDocument();

    // onComplete é chamado no primeiro tick (1s) + delay de 50ms
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('deve chamar onTick com tempo correto calculado via timestamps', () => {
    const now = Date.now();
    const onTick = vi.fn();
    const snapshot: DailyFocusLive = {
      taskTitle: 'Tarefa Teste',
      phase: 'work',
      running: true,
      remainingSecs: 10, // 10 segundos
      anchorTs: now,
      totalSecs: 600,
      rushMode: false,
      tabMode: false,
      cycleCount: 0,
      nextTaskTitle: '',
      taskIndex: 0,
      taskCount: 1,
    };

    render(
      <DailyTimer
        totalSeconds={600}
        snapshot={snapshot}
        onTick={onTick}
        onComplete={vi.fn()}
      />
    );

    // Avança 1 segundo
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // onTick deve ter sido chamado com 9 segundos (calculado via timestamp)
    expect(onTick).toHaveBeenCalledWith(expect.any(Number));
    const lastCall = onTick.mock.calls[onTick.mock.calls.length - 1][0];
    expect(lastCall).toBeGreaterThanOrEqual(8); // Pode ter pequena variação
    expect(lastCall).toBeLessThanOrEqual(10);
  });
});
