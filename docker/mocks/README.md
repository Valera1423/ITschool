# Mock-серверы

Локальные заглушки внешних систем для разработки, демо и E2E.

## mock-lms (`docker/mocks/lms/`)

Имитирует LMS ИТ Школы РТК и сайт на Laravel CMS.

**Запуск отдельно:**

```bash
cd docker/mocks/lms
npm install
PORT=4100 MOCK_API_KEY=mock-api-key-123 node server.js