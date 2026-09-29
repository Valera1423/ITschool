import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormProps } from 'react-hook-form';
import type { ZodSchema } from 'zod';

export function useFormWithZod<T extends Record<string, unknown>>(
  schema: ZodSchema<T>,
  options?: Omit<UseFormProps<T>, 'resolver'>,
) {
  return useForm<T>({
    ...options,
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });
}