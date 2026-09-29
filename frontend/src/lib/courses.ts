// frontend/src/lib/courses.ts
import { api } from './api';
import type { Course } from '@/types';

export async function listCourses(): Promise<Course[]> {
  try {
    return await api.get<Course[]>('/courses');
  } catch {
    return [];
  }
}