// backend/src/services/enterprise/factory.ts
import type { ConnectorContext, EnterpriseConnector } from './types.js';
import { SandboxConnector } from './sandbox.js';

/**
 * Фабрика Enterprise-коннекторов.
 *
 * Если в config.sandbox === true → SandboxConnector.
 * Иначе → реальный (пока не реализован — падаем с понятной ошибкой).
 *
 * Так безопасно: в dev/pеред реальной настройкой всё работает
 * в sandbox-режиме, а в prod вы осознанно включаете реальный коннектор.
 */
export function createEnterpriseConnector(
  system: '1c' | 'sap' | 'diadoc' | 'sbis',
  ctx: ConnectorContext,
): EnterpriseConnector {
  const sandbox = ctx.config.sandbox === true;

  if (sandbox) {
    return new SandboxConnector(system, ctx);
  }

  // TODO (следующая итерация): реальные коннекторы.
  // Требуют отдельного согласования контрактов с заказчиком.
  //
  // case '1c':     return new OneCConnector(ctx);
  // case 'sap':    return new SapConnector(ctx);
  // case 'diadoc': return new DiadocConnector(ctx);
  // case 'sbis':   return new SbisConnector(ctx);

  throw new Error(
    `Коннектор «${system}» в prod-режиме ещё не реализован. ` +
      `Поставьте sandbox: true в config интеграции или дождитесь ` +
      `согласования контракта с заказчиком.`,
  );
}