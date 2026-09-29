import { api } from './api';

export interface CustomRole {
  id: string;
  code: string;
  label: string;
  description: string | null;
  permissions: string[];
  baseRole: 'admin' | 'manager' | 'nam';
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: { profiles: number };
}

export interface PermissionDef {
  code: string;
  label: string;
  group: string;
}

export async function listPermissions(): Promise<PermissionDef[]> {
  try { return await api.get<PermissionDef[]>('/custom-roles/permissions'); }
  catch { return []; }
}

export async function listCustomRoles(): Promise<CustomRole[]> {
  try { return await api.get<CustomRole[]>('/custom-roles'); }
  catch { return []; }
}

export async function createCustomRole(input: Partial<CustomRole>): Promise<string | null> {
  try { await api.post('/custom-roles', input); return null; }
  catch (e) { return e instanceof Error ? e.message : 'Ошибка'; }
}

export async function updateCustomRole(id: string, patch: Partial<CustomRole>): Promise<string | null> {
  try { await api.patch(`/custom-roles/${id}`, patch); return null; }
  catch (e) { return e instanceof Error ? e.message : 'Ошибка'; }
}

export async function deleteCustomRole(id: string): Promise<string | null> {
  try { await api.delete(`/custom-roles/${id}`); return null; }
  catch (e) { return e instanceof Error ? e.message : 'Ошибка'; }
}

export async function assignRole(roleId: string, userId: string): Promise<string | null> {
  try { await api.post(`/custom-roles/${roleId}/assign/${userId}`); return null; }
  catch (e) { return e instanceof Error ? e.message : 'Ошибка'; }
}

export async function unassignRole(roleId: string, userId: string): Promise<string | null> {
  try { await api.delete(`/custom-roles/${roleId}/assign/${userId}`); return null; }
  catch (e) { return e instanceof Error ? e.message : 'Ошибка'; }
}