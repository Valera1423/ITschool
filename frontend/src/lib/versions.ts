import { api } from './api';

export interface EntityVersionMeta {
  id: number;
  version: number;
  author_id: string | null;
  author_name: string | null;
  comment: string | null;
  created_at: string;
  changes: Record<string, unknown>;
}

export interface EntityVersionFull extends EntityVersionMeta {
  entity: string;
  entity_id: string;
  snapshot: Record<string, unknown>;
}

export interface VersionDiff {
  from_version: number;
  to_version: number;
  changes: { field: string; before: unknown; after: unknown }[];
}

export async function listVersions(entity: string, entityId: string): Promise<EntityVersionMeta[]> {
  try {
    return await api.get<EntityVersionMeta[]>(`/versions/${entity}/${entityId}`);
  } catch {
    return [];
  }
}

export async function getVersion(entity: string, entityId: string, version: number) {
  try {
    return await api.get<EntityVersionFull>(`/versions/${entity}/${entityId}/${version}`);
  } catch {
    return null;
  }
}

export async function diffVersions(entity: string, entityId: string, from: number, to: number) {
  try {
    return await api.get<VersionDiff>(`/versions/${entity}/${entityId}/diff/${from}/${to}`);
  } catch {
    return null;
  }
}

export async function rollbackToVersion(entity: string, entityId: string, version: number) {
  try {
    const r = await api.post<{ snapshot: Record<string, unknown> }>(
      `/versions/${entity}/${entityId}/${version}/rollback`,
    );
    return r.snapshot;
  } catch {
    return null;
  }
}