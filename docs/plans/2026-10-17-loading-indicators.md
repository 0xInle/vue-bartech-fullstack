# Единая индикация загрузки — план реализации

> **Для исполнителя:** реализовать план по задачам и сверяться со спецификацией, не менять несвязанные пользовательские изменения.

**Цель:** заменить текстовые заглушки ожидания данных на доступный зелёный PrimeVue `ProgressSpinner` на страницах и в открывающихся Drawer/Dialog.

**Архитектура:** создать небольшой общий компонент загрузки, который оборачивает `ProgressSpinner`, задаёт основной зелёный цвет приложения и доступное имя. Подключить компонент в Nuxt и заменить только отображение реальных первичных загрузок, сохранив текущие условия, ошибки и состояния кнопок.

**Стек:** Nuxt 4, Vue 3, PrimeVue 4.5.5, `@primeuix/themes` Aura.

**Спецификация:** `docs/specs/2026-10-17-loading-indicators-design.md`.

## Общие ограничения

- Не менять условия запросов, кэширование, API, бизнес-правила, разрешения и навигацию.
- Не добавлять зависимости, тестовые файлы или тестовую инфраструктуру.
- Не запускать тесты, typecheck, сервер или браузерную проверку без отдельной команды пользователя.
- Форматировать только изменённые файлы командой `pnpm exec prettier --write <пути>`.
- Сохранить имеющиеся параллельные изменения в рабочем дереве; `packages/database/src/index.js` принадлежит пользователю и не относится к задаче.

## Фокус ревью

- Первичная загрузка отличается от повторного фонового обновления — индикатор не должен скрывать уже показанные данные.
- Ошибка после неудачной загрузки должна отображаться вместо индикатора.
- Drawer/Dialog с готовым или кэшированным содержимым не должен задерживаться.
- Информационные статусы, пустые состояния и подтверждения операций не являются загрузкой.
- Индикатор и его доступное имя должны работать во всех местах, где компонент переиспользуется.

---

### Задача 1. Общий компонент загрузки

**Файлы:**

- Создать `apps/web/app/components/LoadingIndicator.vue`.
- Изменить `apps/web/nuxt.config.ts`.

**Результат:**

- Компонент показывает PrimeVue `ProgressSpinner`, центрирует его в доступной ширине, задаёт `aria-label="Загрузка"` и приводит все четыре цветовых сегмента через токены `--p-progressspinner-color-*` к `var(--p-button-text-primary-color)`.
- Компонент поддерживает передачу класса для внешнего отступа, не добавляет собственного текста и не управляет состоянием загрузки.
- Добавить `ProgressSpinner` в список PrimeVue-компонентов Nuxt для автоимпорта.

**Шаги:**

- [x] Создать компонент с описанным поведением и без новых зависимостей.
- [x] Подключить `ProgressSpinner` в `primevue.components.include`.
- [x] Проверить форматирование этих двух файлов.

### Задача 2. Состояния загрузки экранов и страниц

**Файлы:**

- Изменить `apps/web/app/features/analytics/components/InternalProductAnalyticsScreen.vue`.
- Изменить `apps/web/app/features/archive/components/ArchiveCardScreen.vue` и `ArchiveListScreen.vue` только для состояний, которые используют текст ожидания; существующие Skeleton оставить.
- Изменить `apps/web/app/features/cocktails/components/CocktailCardScreen.vue` и `CocktailListScreen.vue`.
- Изменить `apps/web/app/features/exports/components/ClosureOperationScreen.vue`, `ClosureExportPicker.vue` и `ProductExportsScreen.vue`.
- Изменить `apps/web/app/features/garnishes/components/GarnishCardScreen.vue` и `GarnishListScreen.vue`.
- Изменить `apps/web/app/features/history/components/HistoryScreen.vue`.
- Изменить `apps/web/app/features/internal-audit/components/InternalAuditScreen.vue`, `InternalCatalogCategoriesScreen.vue`, `InternalCatalogManagementScreen.vue`, `InternalCatalogScreen.vue`, `InternalServiceAccessScreen.vue`, `InternalServiceProductsScreen.vue` и `InternalSupportScreen.vue`.
- Изменить `apps/web/app/features/invitations/components/InvitationAcceptanceScreen.vue` только для стадии проверки приглашения.
- Изменить `apps/web/app/features/organizations/components/CompanyVenueInvitationScreen.vue`, `EmptyCompanyPageScreen.vue` и `VenueManagementPageScreen.vue`.
- Изменить `apps/web/app/features/preparations/components/PreparationCardScreen.vue` и `PreparationListScreen.vue`.
- Изменить `apps/web/app/features/support/components/SupportScreen.vue`.
- Изменить `apps/web/app/features/team/components/ChefTeamSection.vue`, `TeamManagementScreen.vue` и `TeamPageScreen.vue`.
- Изменить `apps/web/app/features/workspace/components/VenueHomeScreen.vue` и `WorkspaceProfileScreen.vue`.
- Изменить страницы `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/exports/[exportId].vue`, `exports/index.vue` и `history/index.vue`.

**Шаги:**

- [x] Заменить только первичные загрузочные `Message`/текстовые заглушки на общий компонент; сохранить существующие `v-if`/`v-else-if`, области размещения и отступы.
- [x] Сохранить отдельные состояния ошибок, пустых данных, отсутствия доступа, информационные сообщения и завершённые статусы.
- [x] В карточках, где уже используется `Skeleton`, оставить его без изменений, если рядом нет текстовой загрузочной заглушки.
- [x] Форматировать все изменённые файлы.

### Задача 3. Ожидание данных в Drawer и Dialog

**Файлы:**

- Изменить `apps/web/app/features/cocktails/components/CocktailFormDrawer.vue`.
- Изменить `apps/web/app/features/garnishes/components/GarnishFormDrawer.vue`.
- Изменить `apps/web/app/features/preparations/components/PreparationFormDrawer.vue`.
- При обнаружении иных Drawer/Dialog, которые показывают содержимое до завершения первичного запроса обязательных для формы данных, включить соответствующий локальный компонент в этот же список и зафиксировать в отчёте.

**Шаги:**

- [x] Пока обязательные справочники формы впервые загружаются, показывать внутри открытого Drawer общий индикатор вместо интерактивной формы.
- [x] После загрузки показывать форму; при ошибке скрывать индикатор и оставлять текущее сообщение об ошибке и блокировку отправки.
- [x] Не добавлять ожидание там, где данные уже загружены/кэшированы; не менять индикаторы сохранения на кнопках.
- [x] Форматировать изменённые файлы.

### Задача 4. Статическая проверка и передача ревьюеру

**Шаги:**

- [x] Выполнить `pnpm --filter @bartech/web lint` и `pnpm --filter @bartech/web build`.
- [x] Не запускать тесты, typecheck, сервер и браузер.
- [x] Просмотреть diff: подтвердить, что не изменены другие типы сообщений, условия запросов и посторонние файлы.
- [x] Передать изменения независимому `bartech_reviewer` только для чтения; запросить проверку совпадения со спецификацией, доступности индикатора, корректности состояний ошибок/кэша и отсутствия постороннего diff.

## Самопроверка плана

- Все требования спецификации покрыты задачами 1–3; проверка ограничений проекта включена в общие ограничения и задачу 4.
- Ошибки, повторные фоновые обновления, уже загруженный Drawer, нефункциональные сообщения и использование во всех местах указаны как предметы реализации/ревью.
- План не предписывает запрещённые тесты, typecheck или браузерную проверку.
