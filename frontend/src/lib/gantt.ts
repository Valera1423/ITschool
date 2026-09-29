import { api } from './api';

export interface GanttTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  startDate: string;
  endDate: string;
  progress: number;
  universityId: string | null;
  universityName: string | null;
  createdAt: string;
}

export interface GanttDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: string;
}

export interface GanttData {
  items: GanttTask[];
  dependencies: GanttDependency[];
}

export async function fetchGantt(filters: {
  from?: string;
  to?: string;
  assignee?: string;
  universityId?: string;
} = {}): Promise<GanttData> {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    const res = await api.get<GanttData>(`/gantt?${params.toString()}`);
    return res ?? { items: [], dependencies: [] };
  } catch {
    return { items: [], dependencies: [] };
  }
}

export async function createDependency(input: {
  taskId: string;
  dependsOnTaskId: string;
  type?: string;
}): Promise<string | null> {
  try {
    await api.post('/gantt/dependencies', input);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteDependency(id: string): Promise<string | null> {
  try {
    await api.delete(`/gantt/dependencies/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function moveGanttTask(
  taskId: string,
  startDate: string,
  endDate: string,
): Promise<string | null> {
  try {
    await api.patch(`/gantt/${taskId}`, { startDate, endDate });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}