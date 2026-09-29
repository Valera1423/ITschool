import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { env } from './env.js';
import { logger } from './logger.js';

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    logger.info('OpenTelemetry отключён (нет OTEL_EXPORTER_OTLP_ENDPOINT)');
    return;
  }

  try {
    sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: 'crm-backend',
        [SEMRESATTRS_SERVICE_VERSION]: process.env.APP_VERSION ?? '1.0.0',
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Отключаем шумные
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
        }),
      ],
    });

    sdk.start();
    logger.info('✓ OpenTelemetry запущен');
  } catch (e) {
    logger.warn({ err: e }, 'Не удалось запустить OpenTelemetry');
  }
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown().catch(() => {});
  }
}