# План реализации: редактирование гарнира

> **Для агентных исполнителей:** выполнять задачи последовательно, отмечая
> завершённые шаги `- [x]`. Сценарий и продуктовые границы определяет
> спецификация; этот план задаёт файлы, контракты и проверяемые результаты.

**Цель:** дать пользователю с `manage_products` возможность изменить активный
гарнир из его техкарты и подтвердить предупреждение обо всех использующих его
активных коктейлях текущего заведения.

**Архитектура:** отдельный backend-сценарий повторно проверяет разрешение,
принадлежность и допустимость данных, вычисляет прямые зависимости-коктейли и
сохраняет гарнир с составом атомарно. Публичный PATCH возвращает структурированный
`409`, если требуется подтверждение или обновление списка влияния. Существующий
Drawer формы гарнира получает режим редактирования; отдельный диалог показывает
зависимости и отправляет актуальный отпечаток подтверждения.

**Стек:** NestJS, Prisma/PostgreSQL, OpenAPI/Orval, Nuxt 4, Vue 3, PrimeVue,
VeeValidate, Zod, TanStack Query, pnpm.

**Спецификация:**
`docs/specs/2026-10-16-stage-7-garnish-editing-design.md`.

## Общие ограничения

- Документация и пользовательские тексты — на русском языке.
- Не менять generated API-клиент вручную; обновлять его только штатной
  `pnpm api:generate` и использовать публичные aliases из `@bartech/api-client`.
- Backend повторно проверяет право `manage_products` и область компании,
  заведения, гарнира и компонентов; скрытая кнопка не заменяет серверную проверку.
- Использовать текущий сценарий создания гарнира для валидации допустимых
  компонентов и единиц; не добавлять поля категории и коктейльные справочники.
- Не менять создание гарнира, редактирование коктейлей и заготовок, архив,
  удаление, аудит, выгрузки, схему БД и общую навигацию.
- Не создавать тестовые файлы, тестовую инфраструктуру или зависимости. Тесты,
  typecheck и браузер не запускать без отдельной просьбы пользователя.
- Не выполнять коммит или push; сохранять все посторонние изменения рабочего дерева.
- Форматировать только изменённые файлы штатным Prettier.

## Фокус независимого ревью

- Подмена `companyId`, `venueId`, `garnishId` или ID компонента не позволяет
  прочитать или изменить запись другого заведения.
- Влияние включает каждого непосредственно связанного активного коктейля ровно
  один раз и исключает архивные, несвязанные и чужие карточки.
- Текущий состав, выход, компоненты и единицы предзаполняют форму без потери
  порядка; изменённые данные не отправляются до валидного сохранения.
- Устаревшее подтверждение не позволяет сохранить при изменении списка влияния
  или названий; ошибка не оставляет частично обновлённые поля/связи.
- Drawer не теряет введённые значения при серверной ошибке; список и карточка
  обновляются только после успешного сохранения.

## Карта файлов

| Путь                                                                                         | Ответственность                                                                     |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/backend-products/src/garnishes/garnish-update.service.ts`                          | Разрешение, нормализация, валидация, проверка влияния, подтверждения и аудит.       |
| `packages/backend-products/src/garnishes/garnish-update.repository.ts`                       | Scoped-чтение гарнира и зависимостей, блокировка заведения и транзакционная замена. |
| `packages/backend-products/src/garnishes/garnish-impact.ts`                                  | Стабильный список прямых активных коктейлей и отпечаток подтверждения.              |
| `packages/backend-products/src/garnishes/garnish-update.module.ts`                           | Регистрация сценария обновления и репозитория.                                      |
| `packages/backend-products/src/garnishes/garnish-read.dto.ts` и `garnish-read.repository.ts` | ID компонентов и единиц/выхода для точного заполнения формы.                        |
| `packages/backend-products/src/products.module.ts`, `src/index.ts`                           | Экспорт и подключение нового модуля.                                                |
| `apps/backend/src/products/products.dto.ts`                                                  | DTO запроса обновления и ответа влияния.                                            |
| `apps/backend/src/products/products.controller.ts`                                           | Защищённый PATCH и OpenAPI-ответы.                                                  |
| `apps/backend/src/http/problem-details.filter.ts`                                            | Безопасные поля единственного известного конфликта подтверждения.                   |
| `packages/api-client/openapi.json`, `src/generated/`                                         | Только штатно сгенерированный публичный PATCH-контракт.                             |
| `apps/web/app/features/garnishes/composables/useGarnishes.ts`                                | Мутация, разбор ожидаемого `409` и обновление query-ключей.                         |
| `apps/web/app/features/garnishes/components/GarnishFormDrawer.vue`                           | Общая форма создания/редактирования без дублирования полей.                         |
| `apps/web/app/features/garnishes/components/GarnishImpactDialog.vue`                         | Подтверждение актуального списка затронутых коктейлей.                              |
| `apps/web/app/features/garnishes/components/GarnishCardScreen.vue`                           | Действие редактирования, Drawer и координация повторного подтверждения.             |
| `apps/web/app/features/garnishes/components/GarnishListScreen.vue`                           | Явное сохранение существующего режима создания Drawer.                              |
| `apps/web/app/features/garnishes/README.md`                                                  | Границы feature, создание и редактирование гарнира.                                 |

## Задача 1. Scoped-сценарий обновления и зависимости

**Файлы:** создать `garnish-impact.ts`, `garnish-update.repository.ts`,
`garnish-update.service.ts`, `garnish-update.module.ts`; изменить
`packages/backend-products/src/garnishes/garnish-read.dto.ts`,
`garnish-read.repository.ts`, `products.module.ts`, `index.ts`.

**Контракт сценария:**
`GarnishUpdateService.update(context: CreateProductContext, garnishId: string, input: ProductBaseInput & { confirmationFingerprint?: string })`.
Успех возвращает существующий краткий DTO продукта. Требование подтверждения
возвращает конфликт с `code: "GARNISH_DEPENDENCIES_CONFIRMATION_REQUIRED"`,
`affectedProducts: Array<{ id: string; type: "COCKTAIL"; name: string }>` и
`confirmationFingerprint: string`.

- [x] Добавить в чтение карточки точные `unitId`, ID доступного output unit и
      все значения, необходимые для восстановления редактируемых полей. Сохранить
      существующие подписи и scoped-условие активного гарнира.
- [x] Создать repository с scoped-поиском по ID, venue, типу и активному
      состоянию; допустимыми компонентами и единицами по правилам создания.
- [x] Использовать advisory transaction lock текущего venue, как в сценарии
      редактирования заготовки. Читать актуальные связи `CocktailGarnish` только
      для активных коктейлей этого venue.
- [x] Реализовать стабильную сортировку списка влияния по `name`, затем `id`,
      без дубликатов, и отпечаток, связанный с venue, garnish, нормализованными
      входными данными и списком влияния.
- [x] Реализовать update-сценарий: проверить разрешение, активный гарнир,
      обязательные поля, положительные количества, единицы, допустимые типы
      компонентов, локальные ссылки и уникальность имени теми же правилами,
      что создание. Не принимать category/cocktail reference-поля.
- [x] Не записывать нормализованно неизменённую форму. При изменении без
      зависимостей сохранить сразу; при зависимостях без актуального отпечатка
      вернуть структурированный конфликт без записи; при актуальном отпечатке
      заменить поля и строки состава одной транзакцией.
- [x] Записать `product.updated` в той же транзакции с типом продукта `GARNISH`.
      Ошибки уникальности и конфликтов связанных данных перевести в действующие
      безопасные сообщения по образцу обновления заготовки.
- [x] Подключить/export-ировать `GarnishUpdateModule` через пакет
      `backend-products`, не расширяя ответственность read-модуля.

## Задача 2. API, структурированный конфликт и клиент

**Файлы:** изменить `apps/backend/src/products/products.dto.ts`,
`products.controller.ts`, `apps/backend/src/http/problem-details.filter.ts`,
`apps/web/app/features/garnishes/composables/useGarnishes.ts`; обновить
`packages/api-client/openapi.json` и `packages/api-client/src/generated/` только
командой генерации.

**Маршрут:**
`PATCH /organizations/companies/:companyId/venues/:venueId/products/garnishes/:garnishId`.
Body соответствует полям создания гарнира плюс необязательный отпечаток.

- [x] Добавить отдельные `UpdateGarnishDto` и response DTO для конфликта; не
      принимать тип продукта, состояние или tenant IDs из тела.
- [x] Подключить update-сервис в controller и описать `200`, `400`, `403`,
      `404`, `409` в OpenAPI. Guard и сервис проверяют `manage_products`.
- [x] Разрешить в Problem Details только поля `code`, `affectedProducts` и
      `confirmationFingerprint` для точного кода конфликта гарнира; прочие
      ошибки оставить в общем безопасном формате.
- [x] Выполнить `pnpm api:generate`; проверить публичный alias PATCH-body,
      успешного ответа и ответа конфликта. Не править generated-файлы вручную.
- [x] Добавить `updateGarnish(garnishId, input)` по cookie/CSRF и `requestApi`.
      Обработать ожидаемый конфликт как результат для UI; прочие ошибки
      передавать общей обработке формы. Инвалидировать список и карточку только
      после успешной записи.

## Задача 3. Drawer и предупреждение в интерфейсе

**Файлы:** изменить `GarnishFormDrawer.vue`, `GarnishCardScreen.vue`,
`GarnishListScreen.vue`, `useGarnishes.ts`; создать `GarnishImpactDialog.vue`.

- [x] Добавить явные режимы Drawer `create` и `edit`; оставить текущий путь
      создания работоспособным. При открытии редактирования заполнить поля,
      строки состава, их порядок и единицы только из загруженной карточки.
- [x] Сохранить правила VeeValidate/Zod и поведение грязной формы. В edit-режиме
      отправлять PATCH, не закрывать Drawer и не терять ввод при API-ошибке;
      сбрасывать подтверждение при любом изменении формы.
- [x] Создать диалог списка влияния с числом и названием каждого коктейля,
      кнопками отмены и подтверждения. При повторном `409` заменить список и
      потребовать нового явного подтверждения.
- [x] На карточке показать «Редактировать» только при `manage_products`,
      координировать Drawer/диалог и дождаться актуализации карточки после
      успеха. Не добавлять маршрут редактирования.
- [x] В `GarnishListScreen` явно передать режим `create`, чтобы создание не
      зависело от неявного значения пропа нового Drawer.
- [x] Сохранять в README точные границы режима edit, серверную ответственность,
      ключи списка/карточки и структурированный повторный запрос подтверждения.

## Задача 4. Форматирование, статические проверки и независимое ревью

**Файлы:** только затронутые исходники, generated API и
`docs/plans/2026-10-16-stage-7-garnish-editing.md`.

- [x] Отформатировать только затронутые поддерживаемые файлы через
      `pnpm exec prettier --write <пути-к-файлам>`.
- [x] Выполнить `pnpm api:generate`, если генерация ещё не была выполнена после
      финального изменения OpenAPI.
- [x] Выполнить доступные lint/build-проверки затронутых backend и web workspace;
      не запускать тесты, typecheck или браузер без прямой просьбы пользователя.
- [x] Выполнить `git diff --check`; сверить фактический diff с картой файлов,
      сохранить остальные незакоммиченные изменения.
- [x] Записать в итог плана фактически изменённые файлы, проверки, неисполненные
      проверки и оставшиеся ограничения.
- [x] После сообщения пользователю о фактическом отчёте реализации передать
      изменения отдельному read-only ревьюеру. Он проверяет tenant-изоляцию,
      прямые зависимости, атомарность, контракт API, подтверждение и границы UI.
      Подтверждённых замечаний нет; повторное ревью не требуется.

## Самопроверка плана

- Поля и исключённые коктейльные справочники закреплены в задачах 1–3.
- Изоляция, прямой список активных коктейлей и повторная проверка отпечатка
  закреплены в задачах 1–2.
- Ошибки, отсутствие частичной записи, no-op и аудит закреплены в задаче 1.
- Предзаполнение, права, предупреждение, потеря ввода и актуализация данных
  закреплены в задаче 3.
- OpenAPI, API generation, lint/build/diff-check и независимый review закреплены
  в задаче 4. Запрещённые пользователем тесты, typecheck и браузер не включены.

## Итог реализации

Статус: реализация выполнена и прошла отдельное независимое read-only ревью.

Изменённые файлы:

- `packages/backend-products/src/garnishes/garnish-impact.ts` — стабильный отпечаток
  нормализованных данных и списка активных связанных коктейлей.
- `packages/backend-products/src/garnishes/garnish-update.repository.ts` — scoped-чтение,
  блокировка venue, поиск прямых зависимостей и атомарная замена карточки/состава.
- `packages/backend-products/src/garnishes/garnish-update.service.ts` — право,
  нормализация/валидация, no-op, проверка подтверждения и аудит.
- `packages/backend-products/src/garnishes/garnish-update.module.ts` — отдельная регистрация
  сценария обновления.
- `packages/backend-products/src/garnishes/garnish-read.dto.ts` и
  `garnish-read.repository.ts` — ID единиц и область компонента для предзаполнения.
- `packages/backend-products/src/products.module.ts`, `src/index.ts` — подключение и экспорт
  сценария.
- `packages/backend-products/src/read-component-products.ts` — возврат области компонента
  вместе с доступной карточкой.
- `packages/backend-products/README.md` и `src/garnishes/README.md` — обзор границ backend-пакета
  и сценария гарниров.
- `apps/backend/src/products/products.dto.ts` и `products.controller.ts` — PATCH DTO,
  ответ влияния и защищённый endpoint.
- `apps/backend/src/http/problem-details.filter.ts` — безопасный ответ только для известного
  конфликта подтверждения гарнира.
- `packages/api-client/openapi.json`, `src/generated/index.ts`, `src/generated/models/index.ts`,
  `src/generated/products/products.ts` и сгенерированные модели гарнира/конфликта — результат
  `pnpm api:generate`; вручную generated-файлы не редактировались.
- `apps/web/app/features/garnishes/composables/useGarnishes.ts` — cookie/CSRF PATCH,
  распознавание конфликта и инвалидация списка/карточки после записи.
- `apps/web/app/features/garnishes/components/GarnishFormDrawer.vue` — режимы создания и
  редактирования в одной форме с предзаполнением и сохранением ввода при ошибке.
- `apps/web/app/features/garnishes/components/GarnishImpactDialog.vue` — подтверждение полного
  списка активных коктейлей и повторное подтверждение обновлённого списка.
- `apps/web/app/features/garnishes/components/GarnishCardScreen.vue` и
  `GarnishListScreen.vue` — защищённое действие редактирования и явный режим создания.
- `apps/web/app/features/garnishes/README.md` — границы, поток подтверждения и ключи данных.

Проверки:

- `pnpm api:generate` — успешно; в том числе сборка backend-зависимостей, OpenAPI export и
  генерация Orval-клиента.
- `pnpm --filter @bartech/backend-products lint` — успешно.
- `pnpm --filter @bartech/backend lint` — успешно.
- `pnpm --filter @bartech/web lint` — успешно.
- `pnpm --filter @bartech/backend build` и `pnpm --filter @bartech/web build` — успешно.
- `git diff --check` — успешно.
- Независимый read-only ревьюер проверил изоляцию, прямые зависимости активных коктейлей,
  транзакцию и подтверждение, API/Problem Details и клиентский сценарий; подтверждённых
  дефектов не обнаружено. `git diff --check` ревьюера также прошёл.
- Тесты, typecheck, браузер, сервер, Docker и worker не запускались; новые тесты не создавались.
