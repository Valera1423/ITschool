import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton, TableSkeleton, CardsSkeleton, StatsSkeleton, DashboardSkeleton } from './Skeleton';

const meta: Meta = {
  title: 'UI/Skeletons',
  parameters: { layout: 'padded' },
};

export default meta;

export const Basic: StoryObj = {
  render: () => <Skeleton className="h-4 w-64" />,
};

export const Table: StoryObj = {
  render: () => <TableSkeleton rows={5} cols={4} />,
};

export const Cards: StoryObj = {
  render: () => <CardsSkeleton count={6} />,
};

export const Stats: StoryObj = {
  render: () => <StatsSkeleton count={4} />,
};

export const Dashboard: StoryObj = {
  render: () => <DashboardSkeleton />,
};