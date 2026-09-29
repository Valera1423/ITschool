import type { Vendor, ItDirection, ItProduct, Manager } from '@/types';
import { api } from './api';

/**
 * Единый слой для всех каталогов.
 */

// ============================================================
// VENDORS
// ============================================================

export async function listVendors(): Promise<Vendor[]> {
  try {
    return await api.get<Vendor[]>('/catalogs/vendors');
  } catch {
    return [];
  }
}

export async function upsertVendor(input: {
  id?: string;
  name: string;
  description?: string;
  site?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactMethods?: string[];
}): Promise<string | null> {
  try {
    const payload = {
      name: input.name.trim(),
      description: input.description ?? null,
      site: input.site ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      contactMethods: input.contactMethods ?? [],
    };
    if (input.id) {
      await api.patch(`/catalogs/vendors/${input.id}`, payload);
    } else {
      await api.post('/catalogs/vendors', payload);
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteVendor(id: string): Promise<string | null> {
  try {
    await api.delete(`/catalogs/vendors/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// DIRECTIONS
// ============================================================

export async function listDirections(): Promise<ItDirection[]> {
  try {
    return await api.get<ItDirection[]>('/catalogs/directions');
  } catch {
    return [];
  }
}

export async function upsertDirection(input: {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  color?: string;
  sort_order?: number;
}): Promise<string | null> {
  try {
    const payload = {
      name: input.name.trim(),
      code: input.code ?? null,
      description: input.description ?? null,
      color: input.color ?? 'sky',
      sortOrder: input.sort_order ?? 100,
    };
    if (input.id) {
      await api.patch(`/catalogs/directions/${input.id}`, payload);
    } else {
      await api.post('/catalogs/directions', payload);
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteDirection(id: string): Promise<string | null> {
  try {
    await api.delete(`/catalogs/directions/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// PRODUCTS
// ============================================================

export async function listProducts(): Promise<ItProduct[]> {
  try {
    return await api.get<ItProduct[]>('/catalogs/products');
  } catch {
    return [];
  }
}

export async function upsertProduct(input: {
  id?: string;
  name: string;
  vendor_id?: string | null;
  description?: string;
  license_type?: string;
  color?: string;
  sort_order?: number;
}): Promise<string | null> {
  try {
    const payload = {
      name: input.name.trim(),
      vendorId: input.vendor_id ?? null,
      description: input.description ?? null,
      licenseType: input.license_type ?? null,
      color: input.color ?? 'sky',
      sortOrder: input.sort_order ?? 100,
    };
    if (input.id) {
      await api.patch(`/catalogs/products/${input.id}`, payload);
    } else {
      await api.post('/catalogs/products', payload);
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteProduct(id: string): Promise<string | null> {
  try {
    await api.delete(`/catalogs/products/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// MANAGERS
// ============================================================

export async function listManagers(activeOnly = false): Promise<Manager[]> {
  try {
    const q = activeOnly ? '?activeOnly=true' : '';
    return await api.get<Manager[]>(`/catalogs/managers${q}`);
  } catch {
    return [];
  }
}

export async function createManager(input: Partial<Manager>): Promise<string | null> {
  try {
    await api.post('/catalogs/managers', {
      fullName: input.full_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      position: input.position ?? null,
      department: input.department ?? null,
      avatarColor: input.avatar_color ?? 'blue',
      active: input.active ?? true,
      sortOrder: input.sort_order ?? 100,
      notes: input.notes ?? null,
      profileId: input.profile_id ?? null,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function updateManager(
  id: string,
  patch: Partial<Manager>,
): Promise<string | null> {
  try {
    await api.patch(`/catalogs/managers/${id}`, {
      fullName: patch.full_name,
      email: patch.email,
      phone: patch.phone,
      position: patch.position,
      department: patch.department,
      avatarColor: patch.avatar_color,
      active: patch.active,
      sortOrder: patch.sort_order,
      notes: patch.notes,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteManager(id: string): Promise<string | null> {
  try {
    await api.delete(`/catalogs/managers/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// КОНСТАНТЫ
// ============================================================

export const HANDOVER_STATUSES = [
  'Не передан',
  'Передан частично',
  'Передан полностью',
  'Отозван',
] as const;