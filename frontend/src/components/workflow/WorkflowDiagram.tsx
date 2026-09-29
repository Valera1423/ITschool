// frontend/src/components/workflow/WorkflowDiagram.tsx
import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type {
  WorkflowStep,
  WorkflowStatusCatalog,
  WorkflowTransition,
} from '@/types';
import { stepStatusLabel } from '@/lib/workflow';
import { EmptyState } from '@/components/ui';
import { HEX_COLORS } from '@/lib/colors';

interface Props {
  steps: WorkflowStep[];
  catalog: WorkflowStatusCatalog[];
  onStepClick?: (step: WorkflowStep) => void;
  currentStepId?: string | null;
  transitions?: WorkflowTransition[];
}

/**
 * Цвета статусов шагов — hex, потому что React Flow принимает цвета
 * в inline style, а не через Tailwind-классы.
 * Единый источник — lib/colors.ts.
 */
const STATUS_COLORS: Record<string, string> = {
  pending:     HEX_COLORS.slate,
  in_progress: HEX_COLORS.amber,
  waiting:     HEX_COLORS.sky,
  done:        HEX_COLORS.emerald,
  cancelled:   HEX_COLORS.rose,
  skipped:     HEX_COLORS.slate,
};

export function WorkflowDiagram({
  steps,
  catalog,
  onStepClick,
  currentStepId,
  transitions,
}: Props) {
  const transitionsByStep = useMemo(() => {
    const map: Record<string, number> = {};
    (transitions ?? []).forEach((t) => {
      map[t.step_id] = (map[t.step_id] ?? 0) + 1;
    });
    return map;
  }, [transitions]);

  const { nodes, edges } = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);

    const nodes: Node[] = sorted.map((s, i) => {
      const code = s.status_code ?? 'pending';
      const color = STATUS_COLORS[code] ?? HEX_COLORS.slate;
      const isCurrent = currentStepId
        ? s.id === currentStepId
        : code === 'in_progress';
      const clickable = !!onStepClick;
      const transCount = transitionsByStep[s.id] ?? 0;

      return {
        id: s.id,
        type: 'default',
        position: { x: (i % 4) * 260, y: Math.floor(i / 4) * 140 },
        data: {
          code,
          label: (
            <div
              className={`text-left w-full ${clickable ? 'cursor-pointer' : ''}`}
              onClick={clickable ? () => onStepClick!(s) : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onStepClick!(s);
                      }
                    }
                  : undefined
              }
            >
              <div className="text-[10px] font-mono opacity-70">
                Шаг {s.step_order}
              </div>
              <div className="text-xs font-medium mt-0.5">{s.title}</div>
              <div
                className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded text-white"
                style={{ background: color }}
              >
                {stepStatusLabel(s, catalog)}
              </div>
              {transCount > 0 && (
                <div className="text-[9px] text-atmr-fg-muted mt-1">
                  📝 {transCount} переход(ов)
                </div>
              )}
              {isCurrent && (
                <div className="text-[9px] mt-1 font-semibold text-atmr-warning">
                  ← текущий шаг
                </div>
              )}
            </div>
          ),
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: 'var(--atmr-bg-surface1)',
          color: 'var(--atmr-fg)',
          border: `${isCurrent ? 3 : 2}px solid ${color}`,
          borderRadius: 12,
          padding: 10,
          width: 220,
          fontSize: 12,
          boxShadow: isCurrent
            ? `0 0 0 4px ${color}22, 0 4px 12px rgba(0,0,0,0.1)`
            : 'none',
        },
      };
    });

    const edges: Edge[] = sorted.slice(0, -1).map((s, i) => {
      const next = sorted[i + 1];
      const animated =
        s.status_code === 'in_progress' ||
        s.id === currentStepId ||
        next.id === currentStepId;
      const strokeColor = animated ? STATUS_COLORS.in_progress : HEX_COLORS.slate;
      return {
        id: `e-${s.id}-${next.id}`,
        source: s.id,
        target: next.id,
        type: 'smoothstep',
        animated,
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        style: { stroke: strokeColor, strokeWidth: animated ? 3 : 2 },
      };
    });

    return { nodes, edges };
  }, [steps, catalog, onStepClick, currentStepId, transitionsByStep]);

  if (steps.length === 0) {
    return (
      <div className="rounded-atmr-xl border border-atmr-border-soft bg-atmr-bg-surface1 p-10">
        <EmptyState
          text="Нет шагов для отображения"
          hint="Добавьте шаги в workflow в разделе «Workflow»"
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-atmr-xl border border-atmr-border-soft bg-atmr-bg-surface1 overflow-hidden"
      style={{ height: 560 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
        {nodes.length >= 6 && (
          <MiniMap
            nodeColor={(n) => {
              const code = (n.data as { code?: string }).code ?? 'pending';
              return STATUS_COLORS[code] ?? HEX_COLORS.slate;
            }}
            pannable
            zoomable
          />
        )}
      </ReactFlow>
    </div>
  );
}