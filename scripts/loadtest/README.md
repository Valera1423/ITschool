# Нагрузочные тесты (k6)

Проверяют нефункциональные требования ТЗ п.5:

| № | Требование | Скрипт |
|---|---|---|
| НФТ-1 | Время отклика UI < 1 сек (p95) | все |
| НФТ-6 | 50 параллельных пользователей | `50-users.js`, `mixed-load.js` |
| НФТ-7 | 10 параллельных отчётов | `10-reports.js`, `mixed-load.js` |

## Установка k6

```bash
# macOS
brew install k6

# Ubuntu / Debian
sudo gpg -k
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (Chocolatey)
choco install k6