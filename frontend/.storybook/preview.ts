// frontend/.storybook/preview.ts
import type { Preview } from '@storybook/react';
import React from 'react';

import '../src/styles/ds/primitives.css';
import '../src/styles/ds/palettes-shared.css';
import '../src/styles/ds/fonts.css';
import '../src/styles/ds/themes/default-light.css';
import '../src/styles/ds/themes/default-dark.css';
import '../src/styles/ds/themes/purple-light.css';
import '../src/styles/ds/themes/purple-dark.css';
import '../src/styles/ds/typography.css';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i } },
    backgrounds: { disable: true },
  },
  globalTypes: {
    colorTheme: {
      description: 'Цветовая тема',
      defaultValue: 'default',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Orange (default)' },
          { value: 'purple',  title: 'Purple' },
        ],
      },
    },
    mode: {
      description: 'Светлый / тёмный режим',
      defaultValue: 'light',
      toolbar: {
        icon: 'sun',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark',  title: 'Dark' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const { colorTheme, mode } = context.globals;
      const themeClass =
        colorTheme === 'purple'
          ? (mode === 'dark' ? 'Theme_root_rtk_purple_dark' : 'Theme_root_rtk_purple_light')
          : (mode === 'dark' ? 'Theme_root_rtk_default_dark' : 'Theme_root_rtk_default_light');

      const darkClass = mode === 'dark' ? 'dark' : '';

      return React.createElement(
        'div',
        {
          className: `${themeClass} ${darkClass} bg-atmr-bg-page text-atmr-fg min-h-screen p-6`,
        },
        React.createElement(Story),
      );
    },
  ],
};

export default preview;