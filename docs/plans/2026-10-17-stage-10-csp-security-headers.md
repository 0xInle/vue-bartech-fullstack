# План среза этапа 10: CSP и безопасные HTTP-заголовки

**Статус:** реализован и прошёл независимое read-only ревью без подтверждённых замечаний.
Web lint, web build и `git diff --check` прошли; сборка завершилась с предупреждениями Rollup.
Тесты, typecheck, браузерные, серверные и контейнерные проверки не запускались.

> **Для исполнителей:** реализовать утверждённый объём ролью `bartech_programmer`, затем передать
> изменения отдельному read-only `bartech_reviewer`. Не создавать тестовые файлы и не запускать
> тесты, typecheck, браузер, сервер или контейнеры без отдельной команды пользователя. Не выполнять
> commit или push. Сохранять все текущие изменения, включая незакоммиченные изменения `nuxt.config.ts`.

**Цель:** завершить согласованный пункт безопасности этапа 10, сохранив строгую CSP с nonce и
корректно используя механизм security-заголовков `nuxt-security` для маршрутов приглашений.

**Архитектура:** `nuxt-security@2.6.0` уже подключён в `apps/web/nuxt.config.ts`. Глобальный
`strict: true`, nonce и действующая CSP соответствуют `ARCHITECTURE.md`; версия пакета уже задаёт
базовые защитные заголовки. CSP действует на HTML-ответы, но не добавляется к JSON API. HSTS остаётся
отключённым до настройки production HTTPS и reverse proxy на этапе 11.

**Технологии:** Nuxt 4, `nuxt-security@2.6.0`, pnpm workspace.

**Источники:** раздел «Безопасность» в `ARCHITECTURE.md`, область и критерии этапа 10 в
`DEVELOPMENT_PLAN.md`, официальная [документация CSP Nuxt Security](https://nuxt-security.vercel.app/headers/csp)
и [документация security-заголовков и routeRules](https://nuxt-security.vercel.app/advanced/security-headers).

## Глобальные ограничения

- Сервер остаётся источником полномочий и бизнес-состояния.
- CSP для SSR HTML остаётся в режиме enforce, использует одноразовый nonce, не добавляет
  `unsafe-inline` в `script-src` и не ослабляет текущие директивы.
- Не добавлять CSP к JSON API-ответам.
- Не включать HSTS до подтверждённой production-конфигурации HTTPS на этапе 11.
- Не добавлять зависимости, CSP-report endpoint или внешние security-сервисы.
- Не запускать тесты, typecheck, браузер, сервер или контейнер без отдельной команды пользователя.
- Не выполнять commit или push; сохранять существующие и параллельные изменения.

## Область файлов

- `apps/web/nuxt.config.ts` — оставить глобальную CSP и strict defaults без ослабления; для
  `/invitations` и `/invitations/**` перенести `Referrer-Policy: no-referrer` из обычного
  `routeRules.headers` в `routeRules.security.headers.referrerPolicy`. Сохранить действующие
  `Cache-Control: no-store` и `X-Robots-Tag: noindex, nofollow`.
- `DEVELOPMENT_PLAN.md` — после ревью отметить выполнение CSP/HTTP-заголовков и описать явно
  оставшиеся на этапе 11 настройки HSTS и reverse proxy. Не отмечать этап 10 формально завершённым,
  если для его критериев остаётся непроведённая обязательная проверка.

## Риски и границы

- Изменение обычных route-rule headers может конфликтовать с заголовками Nuxt Security. Security-
  заголовки маршрута должны задаваться через `security`, остальные — через обычный `headers`.
- Перенос должен оставить no-referrer для обоих маршрутов приглашений и не менять их robots/cache
  поведение.
- Не менять `crossOriginEmbedderPolicy`, отключённый HSTS, CSP-директивы или безопасность API.
- `nuxt-security` управляет заголовками веб-приложения; настройки production-прокси, TLS и API
  остаются в этапе 11.

## Шаги реализации

### Задача 1: привести заголовки приглашений к API Nuxt Security

**Файлы:** `apps/web/nuxt.config.ts`.

- [x] Переместить `referrer-policy: no-referrer` обоих invitation route rules в
      `security.headers.referrerPolicy: "no-referrer"`.
- [x] Сохранить `cache-control: no-store` и `X-Robots-Tag: noindex, nofollow` как обычные
      заголовки; не менять глобальную CSP и значения strict defaults.
- [x] Проверить конфигурацию чтением diff и выполнить `pnpm --filter @bartech/web lint` и
      `pnpm --filter @bartech/web build`; зафиксировать результат и предупреждения без запуска
      браузера или runtime.

### Задача 2: зафиксировать статус пункта этапа

**Файлы:** `DEVELOPMENT_PLAN.md`.

- [x] После независимого read-only ревью отметить CSP и защитные заголовки веб-приложения как
      реализованные; записать, что HSTS/TLS и security-заголовки reverse proxy относятся к этапу 11.
- [x] Не объявлять весь этап 10 завершённым, поскольку обязательные критерии формальной приёмки
      и runtime-поведение ещё не подтверждены.

## Критерии готовности

- CSP остаётся strict и nonce-based, соответствует согласованной архитектуре и действует на HTML.
- Конфигурация не содержит CSP для JSON API.
- На `/invitations` и `/invitations/**` задан `no-referrer` через Nuxt Security; `no-store` и
  `noindex, nofollow` сохранены.
- HSTS не включён до production TLS.
- Web lint, web build и `git diff --check` проходят.
- Независимое read-only ревью не выявляет подтверждённых дефектов.
- Тесты, typecheck, браузер, сервер и контейнеры не запускаются без отдельной команды.
