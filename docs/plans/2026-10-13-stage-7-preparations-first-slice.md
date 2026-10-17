# План реализации первого среза этапа 7: заготовки

> **Для агентов-исполнителей:** выполнять задачи последовательно, сохраняя границы ответственности файлов. Новые тесты, тестовая инфраструктура и зависимости не создаются без отдельного согласования пользователя.

**Цель:** дать сотруднику список и технологические карты заготовок текущего заведения, а пользователю с `manage_products` — безопасное создание заготовки в Drawer.

**Архитектура:** чтение выделяется в backend-модуль `preparations`, который отвечает только за список и карточку и ограничивает все запросы текущим `venueId`. Создание остаётся в существующем `ProductsService.createPreparation`. Во frontend появляется изолированный `features/preparations`; Nuxt-маршруты остаются тонкими контейнерами.

**Технологии:** NestJS 11, Prisma, OpenAPI и Orval, Nuxt 4, Vue 3, PrimeVue 4, TanStack Query, VeeValidate, Zod.

**Спецификация:** `docs/specs/2026-10-13-stage-7-preparations-first-slice-design.md`

## Глобальные ограничения

- В срез входят список, карточка и создание заготовки; не входят редактирование, архив, удаление, выгрузка и история.
- Backend является источником прав и области данных: каждое чтение и создание ограничиваются текущими `companyId` и `venueId`.
- Создание использует существующий `POST .../products/preparations`; новые GET-операции публикуются через OpenAPI и штатный `pnpm api:generate`.
- Страницы Nuxt — тонкие контейнеры; интерфейсная логика находится в `features/preparations`.
- Создание открывается только в Drawer: справа на desktop, на весь экран на телефоне; отдельного URL создания нет.
- Список хранит поиск, фильтр категории и сортировку в URL; при возврате из техкарты восстанавливает позицию прокрутки.
- Общая и серверная ошибки находятся сверху Drawer, полевые — рядом с контролами; ответ API не очищает введённые данные.
- Не создавать и не запускать тесты, `typecheck`, dev-сервер, браузерную проверку или Docker без отдельной команды пользователя.

## Фокус ревью

1. Прямой URL карточки чужой, архивной или несуществующей заготовки не раскрывает факт её существования.
2. Подмена параметров URL не позволяет списку показать ингредиенты, коктейли, гарниры, архивные записи или заготовки другого заведения.
3. Пользователь без `manage_products` не видит создание, а прямой POST всё равно отклоняется сервером.
4. В составе допустимы только глобальные ингредиенты, локальные ингредиенты и заготовки текущего заведения; циклическая зависимость отклоняется сервером.
5. Отмена изменённого Drawer требует подтверждения, а ответ 4xx/5xx не закрывает форму и не теряет значения.

## Целевая структура

```text
packages/backend-products/src/preparations/
├── preparation-read.dto.ts
├── preparation-read.repository.ts
├── preparation-read.service.ts
└── preparation-read.module.ts

apps/backend/src/products/
├── products.controller.ts
└── products.dto.ts

apps/web/app/
├── pages/app/companies/[companyId]/venues/[venueId]/preparations/index.vue
├── pages/app/companies/[companyId]/venues/[venueId]/preparations/[preparationId].vue
└── features/preparations/
    ├── README.md
    ├── components/
    │   ├── PreparationListScreen.vue
    │   ├── PreparationCardScreen.vue
    │   ├── PreparationFormDrawer.vue
    │   └── PreparationComponentRows.vue
    └── composables/usePreparations.ts
```

`preparations` на backend отвечает только за чтение. `ProductsService` остаётся владельцем создания и серверных правил состава. `PreparationFormDrawer` координирует форму и сохранение; `PreparationComponentRows` отвечает лишь за редактирование строк и переиспользует публичные элементы `features/products`.

## Задачи и порядок

### 1. Добавить read-модуль заготовок и HTTP-контракт

**Файлы:**

- Создать: `packages/backend-products/src/preparations/preparation-read.dto.ts`
- Создать: `packages/backend-products/src/preparations/preparation-read.repository.ts`
- Создать: `packages/backend-products/src/preparations/preparation-read.service.ts`
- Создать: `packages/backend-products/src/preparations/preparation-read.module.ts`
- Изменить: `packages/backend-products/src/products.module.ts`
- Изменить: `packages/backend-products/src/index.ts`
- Изменить: `apps/backend/src/products/products.controller.ts`
- Изменить: `apps/backend/src/products/products.dto.ts`
- Изменить: `apps/backend/src/products/products-api.module.ts`

**Интерфейсы:**

- `PreparationReadService.list(context, query): Promise<PreparationListItem[]>` принимает `query?: string`, `categoryCode?: string`, `sort?: "name" | "updated"`.
- `PreparationReadService.getById(context, preparationId): Promise<PreparationCard>` возвращает доступную активную заготовку или единое состояние недоступности.
- `GET .../products/preparations` принимает `query`, `categoryCode` и `sort`.
- `GET .../products/preparations/:preparationId` возвращает карточку заготовки.

- [ ] Создать DTO списка и карточки: элемент списка содержит `id`, `name`, `categoryName`, `componentSummary`, `updatedAt`; карточка — `id`, `name`, `type: "PREPARATION"`, `status: "ACTIVE"`, категорию, состав, технологию, необязательные выход и комментарий.
- [ ] В repository реализовать scoped-запрос списка с точными условиями `venueId`, `type = PREPARATION`, `status = ACTIVE`; применить нормализованный поиск по названию, точный системный `categoryCode` и сортировку `name asc` либо `updatedAt desc, name asc`.
- [ ] В repository реализовать карточку с теми же ограничениями, упорядоченными строками состава, названием и ID компонента, его количеством и единицей; вернуть `null` при отсутствии, недоступности или отсутствии технологии.
- [ ] В сервисе повторно проверить `view_products` через `OrganizationsService`, нормализовать входные параметры, разрешать только `name` и `updated`, а для отсутствующей или чужой записи возвращать `NotFoundException`.
- [ ] Добавить DTO query и response, тонкие GET-маршруты и OpenAPI-аннотации в существующий контроллер. Не дублировать и не менять существующий POST создания заготовки.
- [ ] Зарегистрировать read-модуль в `ProductsModule`, экспортировать публичный сервис через `packages/backend-products/src/index.ts` и выполнить штатную `pnpm api:generate`.
- [ ] Форматировать только изменённые файлы, выполнить разрешённые lint затронутых backend workspace и `git diff --check`. Тесты, `typecheck`, сервер, браузер и Docker не запускать.

### 2. Создать composable данных, маршруты и навигацию

**Файлы:**

- Создать: `apps/web/app/features/preparations/composables/usePreparations.ts`
- Создать: `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/preparations/index.vue`
- Создать: `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/preparations/[preparationId].vue`
- Изменить: `apps/web/app/features/workspace/components/WorkspaceShell.vue`

**Интерфейсы:**

- `usePreparations(companyId, venueId)` возвращает состояние URL, query списка и справочников, `preparationQuery(id)`, `createPreparation(input)` и ключи `preparation-list`/`preparation-card`.
- Маршрут списка: `/app/companies/:companyId/venues/:venueId/preparations`.
- Маршрут карточки: `/app/companies/:companyId/venues/:venueId/preparations/:preparationId`.

- [ ] Использовать только сгенерированные методы API и `requestApi`; для записи повторить cookie и CSRF-паттерн из `useCocktails`.
- [ ] Привязать query key списка к компании, заведению, строке поиска, категории и сортировке. После создания инвалидировать только список текущего заведения и карточку созданной заготовки.
- [ ] Синхронизировать `query`, `category` и `sort` с `route.query`: пустые значения удалять из URL, допустимы только системные коды категории и два значения сортировки. Восстановить scroll-позицию списка через `sessionStorage` с ключом, включающим компанию и заведение.
- [ ] Добавить «Заготовки» в существующую навигацию `WorkspaceShell` для пользователей с `view_products`; не добавлять пункты будущих разделов.
- [ ] Оставить Nuxt-страницы тупыми контейнерами, импортирующими только экран feature-модуля. Форматировать файлы и выполнить lint web workspace без иных проверок.

### 3. Реализовать экран списка и технологическую карту

**Файлы:**

- Создать: `apps/web/app/features/preparations/components/PreparationListScreen.vue`
- Создать: `apps/web/app/features/preparations/components/PreparationCardScreen.vue`
- Создать: `apps/web/app/features/preparations/README.md`

**Интерфейсы:**

- `PreparationListScreen` получает контекст из `useVenueWorkspace`, использует `usePreparations` и управляет видимостью Drawer.
- `PreparationCardScreen` получает `preparationId` из тонкой страницы и использует `usePreparations`.

- [ ] В списке показать заголовок «Заготовки», поиск, Select системной категории и Select сортировки. Отображать desktop-строки и мобильные карточки с названием, категорией, кратким составом и датой изменения.
- [ ] Сделать каждую строку ссылкой на постоянный адрес техкарты; сохранить позицию прокрутки до перехода. Показать отдельные состояния загрузки, ошибки и пустого результата; создание в пустом состоянии доступно только при `manage_products`.
- [ ] В карточке вывести название, тип и состояние, категорию, состав, технологию, выход и комментарий при наличии. Компонент типа `PREPARATION` сделать ссылкой на его доступную техкарту; не раскрывать вложенные рецептуры деревом.
- [ ] Для карточки, которую API не отдаёт, использовать единое сообщение недоступности без различения причин. Не добавлять действия редактирования, архива, удаления, истории или выгрузки.
- [ ] Описать в README ответственность feature-модуля, маршруты, URL-состояние, ключи query и отсутствие логики во входных страницах. Форматировать затронутые файлы и выполнить lint web workspace.

### 4. Реализовать Drawer создания и строки состава

**Файлы:**

- Создать: `apps/web/app/features/preparations/components/PreparationFormDrawer.vue`
- Создать: `apps/web/app/features/preparations/components/PreparationComponentRows.vue`
- Изменить: `apps/web/app/features/preparations/components/PreparationListScreen.vue`
- Изменить: `apps/web/app/features/preparations/composables/usePreparations.ts`

**Интерфейсы:**

- `PreparationFormDrawer` принимает `companyId`, `venueId`, `visible`, `canManage`, возвращает `update:visible` и `created: [preparationId: string]`.
- `PreparationComponentRows` работает с массивом `{ key, productId, product, amount, unitId }` и не содержит бизнес-валидации или HTTP-запросов вне переданного выбора.
- Форма отправляет сгенерированный `CreatePreparationDto` без ручного редактирования API-типов.

- [ ] Собрать PrimeVue/VeeValidate/Zod-форму: обязательны категория, название, минимум одна строка состава, положительное количество, единица и технология; выход и комментарий необязательны. Не добавлять поля бокала, льда, метода, гарниров или автоматического расчёта выхода.
- [ ] Использовать `referencesQuery.data.value.preparationCategories` и `units`; опции компонентов получать публичным `IngredientSelector` в существующем scope `COMPONENT`, который уже ограничен допустимыми `INGREDIENT` и `PREPARATION`.
- [ ] Сохранить создание локального ингредиента внутри текущей строки состава через существующий `POST .../products/ingredients`; после успеха назначить карточку строке и сфокусировать незаполненное количество, иначе единицу. Не создавать заготовку из строки состава.
- [ ] Расположить общую ошибку сохранения сверху Drawer и полевые рядом с контролами. При API-ошибке сохранить форму открытой и не очищать значения.
- [ ] Открывать Drawer справа на desktop и во весь экран на телефоне. При попытке закрыть изменённую форму запросить подтверждение, пустую закрыть сразу.
- [ ] По успеху закрыть Drawer, инвалидировать данные, перейти на прямой адрес новой карточки и сбросить состояние загрузки кнопки. Кнопки создания видимы лишь с `manage_products`.
- [ ] Форматировать изменённые файлы, выполнить lint web workspace и `git diff --check`. Не запускать тесты, `typecheck`, dev-сервер, браузер или Docker.

### 5. Зафиксировать результат модуля

**Файлы:**

- Изменить: `apps/web/app/features/preparations/README.md`
- Изменить: `packages/backend-products/README.md` — только если новый модуль меняет описанную структуру пакета.
- Изменить: `docs/plans/2026-10-13-stage-7-preparations-first-slice.md`

- [ ] Указать назначение и границы frontend- и backend-модулей, использованные маршруты, штатную API-генерацию, изменённые файлы и фактически выполненные/невыполненные проверки.
- [ ] Сверить результат со спецификацией: создание только в Drawer, активные данные текущего заведения, URL-состояние списка, доступы, отсутствие циклов на сервере и отсутствие будущих действий в интерфейсе.
- [ ] Выполнить `git diff --check` по затронутым файлам и передать в чат итоговый список изменённых файлов, проверки и ограничения ручной проверки. Не создавать коммит без отдельного указания пользователя.

## Ожидаемые изменения документации

- `apps/web/app/features/preparations/README.md` — назначение модуля, границы компонентов, маршруты и владение данными.
- `packages/backend-products/README.md` — только при необходимости отразить новый read-модуль.
- Этот план — фактический список затронутых файлов и проверок после реализации.

Предметные документы и `MVP_SCOPE.md` не изменяются: план реализует согласованные правила и не создаёт новые.

## Не входит

- Редактирование, архивирование, восстановление, удаление, история, аудит в UI и выгрузка заготовок.
- Создание заготовки или гарнира из строки состава.
- Самостоятельные разделы гарниров, локальных ингредиентов или глобального каталога.
- Глобальный поиск, массовые операции, новый CRM-layout и неработающие элементы будущих функций.
- Новые тесты, тестовая инфраструктура и зависимости.

## Критерии готовности

- Список и прямой адрес карточки раскрывают лишь активные заготовки текущего заведения.
- Поиск, категория и сортировка отражаются в URL, а при возврате из карточки восстанавливается список и его прокрутка.
- Пользователь с `manage_products` создаёт заготовку в Drawer из допустимых компонентов; сервер отклоняет цикл и чужие данные.
- Временный локальный ингредиент возвращает пользователя в исходную строку с выбранной новой карточкой.
- Ошибки понятны, не теряют ввод и общая ошибка находится сверху Drawer.
- В срез не попадают отдельная страница создания, будущие действия и неработающие элементы.

## Фактическое выполнение

Реализованы backend read-модуль `preparations`, два GET-маршрута, сгенерированный OpenAPI-клиент,
feature-модуль frontend, два тонких Nuxt-маршрута, пункт навигации и публичная форма создания
локального ингредиента для строк состава. Создание заготовки по-прежнему использует существующий
`ProductsService.createPreparation`: правила прав, области данных, допустимых компонентов и
циклических зависимостей не дублировались.

Изменены или добавлены файлы из разделов 1–5 плана, а также
`apps/web/app/features/products/components/LocalIngredientCreateForm.vue` и импорт этой публичной
формы в `CocktailComponentRows.vue`. Публичный компонент устраняет дублирование одинаковой
вложенной формы в модулях коктейлей и заготовок.

Выполнены: `pnpm api:generate`, форматирование затронутых файлов, lint workspace-пакетов
`@bartech/backend-products`, `@bartech/backend` и `@bartech/web`, `git diff --check`.
Не выполнялись по ограничениям этапа: тесты, `typecheck`, dev-сервер, браузерная проверка, Docker
и миграции. Коммит и отправка изменений не выполнялись.
