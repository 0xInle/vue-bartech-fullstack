# План реализации первого среза этапа 7: гарниры

> **Для агентов-исполнителей:** выполнять задачи последовательно, сохраняя границы ответственности файлов. Новые тесты, тестовая инфраструктура и зависимости не создаются без отдельного согласования пользователя.

**Цель:** дать сотруднику список и технологические карты гарниров текущего заведения, а пользователю с `manage_products` — безопасное создание гарнира в Drawer.

**Архитектура:** чтение выделяется в backend-модуль `garnishes`, который отвечает только за список и карточку и ограничивает все запросы текущим `venueId`. Создание остаётся в существующем `ProductsService.createGarnish`. Во frontend появляется изолированный `features/garnishes`; Nuxt-маршруты остаются тонкими контейнерами.

**Технологии:** NestJS 11, Prisma, OpenAPI и Orval, Nuxt 4, Vue 3, PrimeVue 4, TanStack Query, VeeValidate, Zod.

**Спецификация:** `docs/specs/2026-10-14-stage-7-garnishes-first-slice-design.md`

## Глобальные ограничения

- В срез входят список, карточка и создание гарнира; не входят редактирование, архив, удаление, выгрузка и история.
- Backend является источником прав и области данных: каждое чтение и создание ограничиваются текущими `companyId` и `venueId`.
- Создание использует существующий `POST .../products/garnishes`; новые GET-операции публикуются через OpenAPI и штатный `pnpm api:generate`.
- Страницы Nuxt — тонкие контейнеры; интерфейсная логика находится в `features/garnishes`.
- Создание открывается только в Drawer: справа на desktop, на весь экран на телефоне; отдельного URL создания нет.
- Список хранит поиск и сортировку в URL; при возврате из техкарты восстанавливает позицию прокрутки после успешной загрузки и отрисовки.
- Общая и серверная ошибки находятся сверху Drawer, полевые — рядом с контролами; ответ API не очищает введённые данные.
- Не создавать и не запускать тесты, `typecheck`, dev-сервер, браузерную проверку или Docker без отдельной команды пользователя.

## Фокус ревью

1. Прямой URL карточки чужого, архивного или несуществующего гарнира не раскрывает факт его существования.
2. Подмена параметров URL не позволяет списку показать ингредиенты, заготовки, коктейли, архивные записи или гарниры другого заведения.
3. Пользователь без `manage_products` не видит создание, а прямой POST всё равно отклоняется сервером.
4. В составе допустимы только глобальные ингредиенты, локальные ингредиенты и заготовки текущего заведения; гарнир или коктейль отклоняются сервером.
5. Отмена изменённого Drawer требует подтверждения, а ответ 4xx/5xx не закрывает форму и не теряет значения.

## Целевая структура

```text
packages/backend-products/src/garnishes/
├── garnish-read.dto.ts
├── garnish-read.repository.ts
├── garnish-read.service.ts
└── garnish-read.module.ts

apps/backend/src/products/
├── products.controller.ts
└── products.dto.ts

apps/web/app/
├── pages/app/companies/[companyId]/venues/[venueId]/garnishes/index.vue
├── pages/app/companies/[companyId]/venues/[venueId]/garnishes/[garnishId].vue
└── features/garnishes/
    ├── README.md
    ├── components/
    │   ├── GarnishListScreen.vue
    │   ├── GarnishCardScreen.vue
    │   ├── GarnishFormDrawer.vue
    │   └── GarnishComponentRows.vue
    └── composables/useGarnishes.ts
```

`garnishes` на backend отвечает только за чтение. `ProductsService` остаётся владельцем создания и серверных правил состава. `GarnishFormDrawer` координирует форму и сохранение; `GarnishComponentRows` отвечает только за строки состава и переиспользует публичные элементы `features/products`.

## Задачи и порядок

### 1. Добавить read-модуль гарниров и HTTP-контракт

**Файлы:**

- Создать: `packages/backend-products/src/garnishes/garnish-read.dto.ts`
- Создать: `packages/backend-products/src/garnishes/garnish-read.repository.ts`
- Создать: `packages/backend-products/src/garnishes/garnish-read.service.ts`
- Создать: `packages/backend-products/src/garnishes/garnish-read.module.ts`
- Изменить: `packages/backend-products/src/products.module.ts`
- Изменить: `packages/backend-products/src/index.ts`
- Изменить: `apps/backend/src/products/products.controller.ts`
- Изменить: `apps/backend/src/products/products.dto.ts`
- Без изменения: `apps/backend/src/products/products-api.module.ts` — уже импортирует `ProductsModule`, который экспортирует новый модуль чтения.

**Интерфейсы:**

- `GarnishReadService.list(context, query?, sort?): Promise<GarnishListItem[]>` принимает строку поиска и сортировку; разрешены только `name` и `updated`.
- `GarnishReadService.getById(context, garnishId): Promise<GarnishCard>` возвращает доступный активный гарнир или единое состояние недоступности.
- `GET .../products/garnishes` принимает `query` и `sort`.
- `GET .../products/garnishes/:garnishId` возвращает карточку гарнира.

- [x] Создать DTO списка и карточки: элемент списка содержит `id`, `name`, `componentSummary`, `updatedAt`; карточка — `id`, `name`, `type: "GARNISH"`, `status: "ACTIVE"`, состав, технологию, необязательные выход и комментарий.
- [x] В repository реализовать scoped-запрос списка с точными условиями `venueId`, `type = GARNISH`, `status = ACTIVE`; применить нормализованный поиск по названию и сортировку `name asc` либо `updatedAt desc, name asc`.
- [x] В repository реализовать карточку с теми же ограничениями, упорядоченными строками состава, ID и типом компонента, его названием, количеством и единицей. Возвращать `null` при отсутствии, недоступности или отсутствии технологии.
- [x] В сервисе повторно проверить `view_products` через `OrganizationsService`, нормализовать входные параметры, разрешать только `name` и `updated`, а для отсутствующей или чужой записи возвращать `NotFoundException`.
- [x] Добавить DTO query и response, тонкие GET-маршруты и OpenAPI-аннотации в существующий контроллер. Не дублировать и не менять существующий POST создания гарнира.
- [x] Зарегистрировать read-модуль в `ProductsModule`, экспортировать публичный сервис через `packages/backend-products/src/index.ts` и выполнить штатную `pnpm api:generate`.
- [x] Форматировать только изменённые файлы, выполнить разрешённые lint затронутых backend workspace и `git diff --check`. Тесты, `typecheck`, сервер, браузер и Docker не запускать.

### 2. Создать composable данных, маршруты и навигацию

**Файлы:**

- Создать: `apps/web/app/features/garnishes/composables/useGarnishes.ts`
- Создать: `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/garnishes/index.vue`
- Создать: `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/garnishes/[garnishId].vue`
- Изменить: `apps/web/app/features/workspace/components/WorkspaceShell.vue`

**Интерфейсы:**

- `useGarnishes(companyId, venueId)` возвращает URL-состояние, query списка и справочников, `garnishQuery(id)`, `createGarnish(input)` и ключи `garnish-list`/`garnish-card`.
- Маршрут списка: `/app/companies/:companyId/venues/:venueId/garnishes`.
- Маршрут карточки: `/app/companies/:companyId/venues/:venueId/garnishes/:garnishId`.

- [x] Использовать только сгенерированные методы API и `requestApi`; для записи повторить cookie и CSRF-паттерн из `usePreparations`.
- [x] Привязать query key списка к компании, заведению, строке поиска и сортировке. После создания инвалидировать только список текущего заведения и карточку созданного гарнира.
- [x] Синхронизировать `query` и `sort` с `route.query`: пустое значение поиска и сортировка `name` удаляются из URL; допустимы только `name` и `updated`. Сохранить scroll-позицию в `sessionStorage` с ключом компании и заведения и восстанавливать её один раз только после `listQuery.isSuccess` и `nextTick`.
- [x] Добавить «Гарниры» в существующую навигацию `WorkspaceShell` для пользователей с `view_products`; не добавлять пункты будущих разделов.
- [x] Оставить Nuxt-страницы тупыми контейнерами, импортирующими только экран feature-модуля. Форматировать файлы и выполнить lint web workspace без иных проверок.

### 3. Реализовать экран списка и технологическую карту

**Файлы:**

- Создать: `apps/web/app/features/garnishes/components/GarnishListScreen.vue`
- Создать: `apps/web/app/features/garnishes/components/GarnishCardScreen.vue`
- Создать: `apps/web/app/features/garnishes/README.md`

**Интерфейсы:**

- `GarnishListScreen` получает контекст из `useVenueWorkspace`, использует `useGarnishes` и управляет видимостью Drawer.
- `GarnishCardScreen` получает `garnishId` из тонкой страницы и использует `useGarnishes`.

- [x] В списке показать заголовок «Гарниры», поиск и Select сортировки. Отображать desktop-строки и мобильные карточки с названием, кратким составом и датой изменения; не добавлять фильтр категории.
- [x] Сделать каждую строку ссылкой на постоянный адрес техкарты; сохранить позицию прокрутки до перехода. Показать отдельные состояния загрузки, ошибки и пустого результата; создание в пустом состоянии доступно только при `manage_products`.
- [x] В карточке вывести название, тип и состояние, состав, технологию, выход и комментарий при наличии. Компонент типа `PREPARATION` сделать ссылкой на его доступную техкарту; не раскрывать вложенные рецептуры деревом.
- [x] Для карточки, которую API не отдаёт, использовать единое сообщение недоступности без различения причин. Не добавлять действия редактирования, архива, удаления, истории или выгрузки.
- [x] Описать в README ответственность feature-модуля, маршруты, URL-состояние, ключи query и отсутствие логики во входных страницах. Форматировать затронутые файлы и выполнить lint web workspace.

### 4. Реализовать Drawer создания и строки состава

**Файлы:**

- Создать: `apps/web/app/features/garnishes/components/GarnishFormDrawer.vue`
- Создать: `apps/web/app/features/garnishes/components/GarnishComponentRows.vue`
- Изменить: `apps/web/app/features/garnishes/components/GarnishListScreen.vue`
- Изменить: `apps/web/app/features/garnishes/composables/useGarnishes.ts`

**Интерфейсы:**

- `GarnishFormDrawer` принимает `companyId`, `venueId`, `visible`, `canManage`, возвращает `update:visible` и `created: [garnishId: string]`.
- `GarnishComponentRows` работает с массивом `{ key, productId, product, amount, unitId }` и не содержит бизнес-валидации или HTTP-запросов вне переданного выбора. Строка определяется стабильным `key`, в том числе при асинхронном создании ингредиента.
- Форма отправляет сгенерированный `CreateGarnishDto` без ручного редактирования API-типов.

- [x] Собрать PrimeVue/VeeValidate/Zod-форму: обязательны название, минимум одна строка состава, положительное количество, единица и технология; выход и комментарий необязательны. Не добавлять категорию, бокал, лёд, метод, другие гарниры или автоматический расчёт выхода.
- [x] Использовать `referencesQuery.data.value.units`; опции компонентов получать публичным `IngredientSelector` в существующем scope `COMPONENT`, который уже ограничен допустимыми `INGREDIENT` и `PREPARATION`.
- [x] Сохранить создание локального ингредиента внутри текущей строки состава через существующий `POST .../products/ingredients`; после успеха назначить карточку строке и сфокусировать незаполненное количество, иначе единицу. Не создавать заготовку или гарнир из строки состава.
- [x] Расположить общую ошибку сохранения сверху Drawer и полевые рядом с контролами. При API-ошибке сохранить форму открытой и не очищать значения.
- [x] Открывать Drawer справа на desktop и во весь экран на телефоне. При попытке закрыть изменённую форму запросить подтверждение, пустую закрыть сразу.
- [x] По успеху закрыть Drawer, инвалидировать данные, перейти на прямой адрес новой карточки и сбросить состояние загрузки кнопки. Кнопки создания видимы лишь с `manage_products`.
- [x] Форматировать изменённые файлы, выполнить lint web workspace и `git diff --check`. Не запускать тесты, `typecheck`, dev-сервер, браузер или Docker.

### 5. Зафиксировать результат модуля

**Файлы:**

- Изменить: `apps/web/app/features/garnishes/README.md`
- Изменить: `packages/backend-products/README.md` — только если новый модуль меняет описанную структуру пакета.
- Изменить: `docs/plans/2026-10-14-stage-7-garnishes-first-slice.md`

- [x] Указать назначение и границы frontend- и backend-модулей, использованные маршруты, штатную API-генерацию, изменённые файлы и фактически выполненные/невыполненные проверки.
- [x] Сверить результат со спецификацией: создание только в Drawer, активные данные текущего заведения, URL-состояние списка, доступы, допустимый состав и отсутствие будущих действий в интерфейсе.
- [x] Выполнить `git diff --check` по затронутым файлам и передать в чат итоговый список изменённых файлов, проверки и ограничения ручной проверки. Не создавать коммит без отдельного указания пользователя.

## Ожидаемые изменения документации

- `apps/web/app/features/garnishes/README.md` — назначение модуля, границы компонентов, маршруты и владение данными.
- `packages/backend-products/README.md` — только при необходимости отразить новый read-модуль.
- Этот план — фактический список затронутых файлов и проверок после реализации.

Предметные документы и `MVP_SCOPE.md` не изменяются: план реализует согласованные правила и не создаёт новые.

## Не входит

- Редактирование, архивирование, восстановление, удаление, история, аудит в UI и выгрузка гарниров.
- Создание заготовки или гарнира из строки состава.
- Самостоятельные разделы локальных ингредиентов или глобального каталога.
- Глобальный поиск, массовые операции, новый CRM-layout и неработающие элементы будущих функций.
- Новые тесты, тестовая инфраструктура и зависимости.

## Критерии готовности

- Список и прямой адрес карточки раскрывают лишь активные гарниры текущего заведения.
- Поиск и сортировка отражаются в URL, а при возврате из карточки восстанавливается список и его прокрутка.
- Пользователь с `manage_products` создаёт гарнир в Drawer из допустимых компонентов; сервер отклоняет гарнир, коктейль и чужие данные в составе.
- Временный локальный ингредиент возвращает пользователя в исходную строку с выбранной новой карточкой.
- Ошибки понятны, не теряют ввод и общая ошибка находится сверху Drawer.
- В срез не попадают отдельная страница создания, будущие действия и неработающие элементы.

## Фактический результат реализации — 14 октября 2026

Первый срез реализован и прошёл разрешённые статические проверки. Это не подтверждение
пользовательского сценария в браузере: независимое ревью и ручная проверка поведения ещё
не выполнены в этой итерации.

### Сохранённая работа предыдущего исполнителя

Backend-модуль чтения, GET/OpenAPI-контракт и штатная генерация API-клиента были выполнены
до продолжения frontend-части. Эта работа сохранена; создание по-прежнему находится
в `ProductsService.createGarnish`, его серверные ограничения не ослаблены. Команда
`pnpm api:generate` в продолжении не повторялась, сгенерированные файлы вручную не изменялись.

Файлы backend и контракта этого среза:

- `packages/backend-products/src/garnishes/garnish-read.dto.ts`;
- `packages/backend-products/src/garnishes/garnish-read.repository.ts`;
- `packages/backend-products/src/garnishes/garnish-read.service.ts`;
- `packages/backend-products/src/garnishes/garnish-read.module.ts`;
- `packages/backend-products/src/products.module.ts`;
- `packages/backend-products/src/index.ts`;
- `apps/backend/src/products/products.controller.ts`;
- `apps/backend/src/products/products.dto.ts`;
- `packages/api-client/openapi.json`;
- `packages/api-client/src/generated/index.ts`;
- `packages/api-client/src/generated/models/index.ts`;
- `packages/api-client/src/generated/products/products.ts`;
- `packages/api-client/src/generated/models/garnishListItemResponseDto.ts`;
- `packages/api-client/src/generated/models/garnishCardResponseDto.ts`;
- `packages/api-client/src/generated/models/garnishCardResponseDtoType.ts`;
- `packages/api-client/src/generated/models/garnishCardResponseDtoStatus.ts`;
- `packages/api-client/src/generated/models/garnishCardComponentResponseDto.ts`;
- `packages/api-client/src/generated/models/garnishCardComponentResponseDtoProductType.ts`;
- `packages/api-client/src/generated/models/garnishCardOutputResponseDto.ts`;
- `packages/api-client/src/generated/models/productsControllerListGarnishesParams.ts`;
- `packages/api-client/src/generated/models/productsControllerListGarnishesSort.ts`.

`products-api.module.ts` не понадобилось изменять: он уже импортирует `ProductsModule`.
В продолжении в backend выполнено только целевое форматирование; оно изменило
`garnish-read.repository.ts`, без изменения поведения.

### Завершённая frontend-часть и документация

Созданы:

- `apps/web/app/features/garnishes/composables/useGarnishes.ts`;
- `apps/web/app/features/garnishes/components/GarnishListScreen.vue`;
- `apps/web/app/features/garnishes/components/GarnishCardScreen.vue`;
- `apps/web/app/features/garnishes/components/GarnishFormDrawer.vue`;
- `apps/web/app/features/garnishes/components/GarnishComponentRows.vue`;
- `apps/web/app/features/garnishes/README.md`;
- `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/garnishes/index.vue`;
- `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/garnishes/[garnishId].vue`.

Изменены:

- `apps/web/app/features/workspace/components/WorkspaceShell.vue` — добавлен только пункт
  «Гарниры» под существующим разрешением `view_products`; параллельные изменения сохранены;
- `packages/backend-products/README.md` — добавлены назначение и границы модуля чтения гарниров;
- этот план — отмечены выполненные пункты, фактические файлы, проверки и ограничения.

Поиск и сортировка списка хранятся в URL и передаются в карточку для обратной ссылки.
Прокрутка восстанавливается однократно после успешного запроса и `nextTick`.
Создание доступно только в Drawer при `manage_products`; категории и будущих действий нет.
После успешной записи инвалидируются только список текущего заведения и созданная карточка,
Drawer закрывается и открывается прямой адрес гарнира.

Для карточки и Drawer `useGarnishes(..., { list: false })` не запускает дополнительный запрос
списка и не меняет URL-состояние. Локальный ингредиент назначается строке по стабильному ключу;
его короткая форма расположена вне HTML-формы гарнира, чтобы не было вложенных форм и случайного
сохранения гарнира. Общая ошибка находится сверху; полевые ошибки — у соответствующих контролов.
Закрытие во время сохранения заблокировано; ошибочный ответ сохраняет ввод.

Типы нового frontend-модуля извлекаются из публичных сгенерированных псевдонимов операций:
`ProductsControllerCreateGarnishMutationBody` ссылается на `CreateGarnishDto`, а ответы
`Response200`/`Response201` — на DTO чтения и результата создания. Это необходимо потому,
что текущий публичный `packages/api-client/src/generated/index.ts` экспортирует операции,
но не `models`. Сгенерированный клиент не изменялся вручную. Соседние модули с прямыми
импортами DTO из корня пакета сохранены без изменения; корректность этих импортов требует
отдельной проверки экспорта типов и не подтверждается выполненным lint.

### Выполненные проверки

- `pnpm exec prettier --write <затронутые файлы>` — успешно; форматировались только файлы
  гарниров, их навигация, документация и backend-файлы этого среза, без сгенерированного клиента.
- `pnpm --filter @bartech/backend-products lint` — код завершения 0.
- `pnpm --filter @bartech/backend lint` — код завершения 0.
- `pnpm --filter @bartech/web lint` — код завершения 0.
- `git diff --check` — код завершения 0, замечаний нет.
- Проверены структура файлов и отсутствие отдельной страницы создания или действий будущих
  редактирования/архива. Новые пользовательские тексты и документация написаны по-русски.

Проверка по исходникам выполнена самим исполнителем; она не является независимым ревью.

### Невыполненные проверки и границы результата

По ограничениям задачи не создавались и не запускались тесты; не запускались `typecheck`,
сборка, dev-сервер, браузер, Docker или миграции. Не создавались коммиты и не выполнялся push.

Для последующей ручной проверки остаются:

1. прямой адрес активной карточки и одинаковый отказ для чужой, архивной или отсутствующей;
2. поиск, обе сортировки, возврат из карточки и однократное восстановление прокрутки;
3. видимость создания при разных разрешениях и серверный отказ без `manage_products`;
4. обязательные поля, положительные количества, необязательный выход и сохранение ввода
   после ответов 4xx/5xx;
5. ширина Drawer на телефоне и подтверждение закрытия изменённой формы;
6. создание локального ингредиента, возвращение в исходную строку и фокус количества/единицы;
7. сохранение, переход на созданную карточку и появление гарнира в существующей форме коктейля;
8. серверный отказ для гарнира, коктейля и компонентов чужого заведения в составе.

Перечень является планом ручной проверки, а не отчётом о пройденных сценариях.
