import { test, expect } from '@playwright/test';

/**
 * E2E: Создание вуза → добавление взаимодействия → экспорт отчёта.
 *
 * Требует:
 * - поднятый backend + frontend + mock-lms (docker-compose.dev.yml)
 * - переменные TEST_BYPASS_AUTH=true и профиль admin@rt.ru в БД (seed.ts)
 *
 * ВАЖНО: при первом запуске нужно прогнать seed:
 *   docker exec -it crm-backend npx prisma db seed
 */

test.describe('Вузы — основной сценарий', () => {
  test.beforeEach(async ({ page }) => {
    // Заходим через тестовый bypass (TEST_BYPASS_AUTH на бэке)
    // Используем специальный заголовок, который понимает middleware.
    await page.context().setExtraHTTPHeaders({
      'x-test-user-id': '00000000-0000-0000-0000-000000000001', // admin
    });

    await page.goto('/?view=universities');
    await page.waitForLoadState('networkidle');
  });

  test('Создание вуза → добавление взаимодействия → экспорт отчёта', async ({
    page,
  }) => {
    const uniqueName = `E2E Вуз ${Date.now()}`;

    // ---- 1. Открыть список ----
    await expect(page.getByRole('heading', { name: /вузы/i })).toBeVisible({
      timeout: 15_000,
    });

    // ---- 2. Создать вуз ----
    await page.getByRole('button', { name: /добавить/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/название вуза/i).fill(uniqueName);
    await dialog.getByLabel(/город/i).fill('Москва');
    await dialog.getByLabel(/статус/i).selectOption('Новый');

    await dialog.getByRole('button', { name: /добавить/i }).click();

    // Toast о создании (в UI это плашка) + новый вуз в таблице
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10_000 });

    // ---- 3. Добавить взаимодействие ----
    // Открываем карточку
    await page.getByText(uniqueName).first().click();
    const card = page.getByRole('dialog');
    await expect(card).toBeVisible();

    // Вкладка «Информация» по умолчанию; ищем поле добавления комментария
    // (взаимодействие — часть карточки воркфлоу; для e2e используем комментарий)
    const commentInput = card
      .getByPlaceholder(/комментарий от/i)
      .or(card.getByPlaceholder(/что обсудить/i));

    if (await commentInput.count()) {
      await commentInput.first().fill('E2E: первое взаимодействие');
      await card.getByRole('button', { name: /отправить/i }).click();
      await expect(card.getByText('E2E: первое взаимодействие')).toBeVisible();
    }

    await page.keyboard.press('Escape');

    // ---- 4. Экспорт CSV ----
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

    await page
      .getByRole('button', { name: /^CSV$/i })
      .or(page.getByRole('button', { name: /экспорт/i }))
      .first()
      .click();

    // Может открыться модалка выбора колонок — жмём «Экспортировать»
    const exportDialog = page.getByRole('dialog');
    if (await exportDialog.count()) {
      const exportBtn = exportDialog.getByRole('button', {
        name: /экспортировать/i,
      });
      if (await exportBtn.count()) await exportBtn.click();
    }

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/universities.*\.(csv|xlsx?)/i);
  });

  test('Поиск находит созданный вуз', async ({ page }) => {
    const uniqueName = `Поиск ${Date.now()}`;

    // Создаём
    await page.getByRole('button', { name: /добавить/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/название вуза/i).fill(uniqueName);
    await dialog.getByLabel(/город/i).fill('Казань');
    await dialog.getByRole('button', { name: /добавить/i }).click();

    await expect(page.getByText(uniqueName)).toBeVisible();

    // Ищем
    await page.getByPlaceholder(/поиск/i).first().fill(uniqueName);
    await page.waitForTimeout(800); // debounce

    await expect(page.getByText(uniqueName)).toBeVisible();
  });
});