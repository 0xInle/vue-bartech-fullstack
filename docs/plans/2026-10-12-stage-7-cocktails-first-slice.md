# План реализации первого среза этапа 7: коктейли

> **Для агентов-исполнителей:** выполнять задачи последовательно, сохраняя границы ответственности файлов. Новые тесты, тестовая инфраструктура и зависимости не создаются без отдельного согласования пользователя.

**Цель:** дать сотруднику доступ к списку и карточке коктейлей текущего заведения, а пользователю с `manage_products` — создание коктейля в Drawer с безопасным выбором компонентов.

**Архитектура:** чтение коктейлей выделяется из общего сервиса продукции в узкий backend-модуль `cocktails`, который ограничивает каждый запрос `venueId` и повторно проверяет право просмотра. Существующая операция создания коктейля переиспользуется без изменения бизнес-правил. Во frontend появляется изолированный `features/cocktails`: экран списка, карточка, Drawer формы и composable запросов; страницы Nuxt остаются тонкими контейнерами.

**Технологии:** NestJS 11, Prisma, OpenAPI и Orval, Nuxt 4, Vue 3, PrimeVue 4, TanStack Query, VeeValidate, Zod.

**Спецификация:** `docs/specs/2026-10-12-stage-7-cocktails-first-slice-design.md`

## Глобальные ограничения

- Использовать только согласованный первый срез: список, карточка и создание коктейля; без редактирования, архива, удаления, выгрузок и самостоятельных экранов заготовок или гарниров.
- Backend является источником прав и области данных: каждый чтение и запись ограничены текущими `companyId` и `venueId`.
- Создание остаётся существующим `POST .../products/cocktails`; новые GET-операции публикуются через OpenAPI и штатный `pnpm api:generate`.
- Страницы Nuxt — тонкие контейнеры; ответственность интерфейса лежит в `features/cocktails`.
- Вёрстка использует PrimeVue и существующие токены; не перерабатывать CRM-оболочку или будущую боковую навигацию.
- Общие и серверные ошибки сохранения отображаются вверху Drawer, полевые — рядом с полями; ошибка API не очищает введённые значения.
- После успешного сохранения список и карточка обновляются TanStack Query, Drawer закрывается, пользователь переходит к новой карточке.
- Не создавать и не запускать тесты, `typecheck`, dev-сервер, браузерную проверку или Docker без отдельной команды пользователя.

## Фокус ревью

1. Прямой URL карточки чужого или неактивного коктейля не раскрывает существование продукции другого заведения.
2. Список не показывает заготовки, гарниры, ингредиенты или архивные записи даже при подмене строки поиска.
3. Пользователь без `manage_products` не получает действие создания, а прямой POST всё равно отклоняется сервером.
4. Строка состава не позволяет отправить отсутствующий компонент, неположительное количество или единицу из другого заведения.
5. Отмена Drawer с изменёнными данными требует подтверждения, а ответ 4xx/5xx не закрывает форму и не стирает ввод.

## Целевая структура

```text
packages/backend-products/src/cocktails/
├── cocktail-read.dto.ts
├── cocktail-read.repository.ts
├── cocktail-read.service.ts
└── cocktail-read.module.ts

apps/backend/src/products/
├── products.controller.ts
└── products.dto.ts

apps/web/app/
├── pages/app/companies/[companyId]/venues/[venueId]/cocktails/index.vue
├── pages/app/companies/[companyId]/venues/[venueId]/cocktails/[cocktailId].vue
└── features/cocktails/
    ├── README.md
    ├── components/
    │   ├── CocktailListScreen.vue
    │   ├── CocktailCardScreen.vue
    │   ├── CocktailFormDrawer.vue
    │   ├── CocktailComponentRows.vue
    │   └── LocalIngredientCreateForm.vue
    └── composables/useCocktails.ts
```

`cocktails` на backend отвечает только за чтение коктейлей. Существующий `ProductsService` остаётся владельцем создания и серверных правил продукции. `CocktailFormDrawer` координирует форму и сохранение; `CocktailComponentRows` работает только с динамическими строками состава; `LocalIngredientCreateForm` создаёт временную локальную карточку и возвращает её в выбранную строку.

## Задачи и порядок

### 1. Добавить read-модуль коктейлей и HTTP-контракт

**Файлы:**

- Создать: `packages/backend-products/src/cocktails/cocktail-read.dto.ts`
- Создать: `packages/backend-products/src/cocktails/cocktail-read.repository.ts`
- Создать: `packages/backend-products/src/cocktails/cocktail-read.service.ts`
- Создать: `packages/backend-products/src/cocktails/cocktail-read.module.ts`
- Изменить: `packages/backend-products/src/products.module.ts`
- Изменить: `packages/backend-products/src/index.ts`
- Изменить: `apps/backend/src/products/products.controller.ts`
- Изменить: `apps/backend/src/products/products.dto.ts`
- Изменить: `apps/backend/src/products/products-api.module.ts`

**Интерфейсы:**

- `CocktailReadService.list(context: CreateProductContext, query?: string): Promise<CocktailListItem[]>`
- `CocktailReadService.getById(context: CreateProductContext, cocktailId: string): Promise<CocktailCard>`
- `CocktailReadService.listGarnishes(context: CreateProductContext, query?: string): Promise<CocktailGarnishOption[]>`
- `GET .../products/cocktails?query=` возвращает только активные коктейли текущего заведения.
- `GET .../products/cocktails/:cocktailId` возвращает доступную карточку или единый ответ недоступности.
- `GET .../products/cocktails/garnishes?query=` возвращает только активные гарниры текущего заведения.

- [ ] Реализовать в repository scoped-запрос списка: `type = COCKTAIL`, `status = ACTIVE`, точное `venueId`; ограничить поиск названием, вернуть `id`, имя, краткий состав и `updatedAt`.
- [ ] Реализовать отдельный scoped-запрос гарниров: только `type = GARNISH`, `status = ACTIVE` и точный `venueId`; глобальные ингредиенты, заготовки и гарниры других заведений в ответ не попадают.
- [ ] Реализовать чтение карточки с типом и состоянием, упорядоченными строками состава с названием компонента/количеством/единицей, гарнирами, технологией, фактическим выходом и комментарием. Все связи состава и гарниров ограничить текущим заведением либо допустимым глобальным ингредиентом.
- [ ] В сервисе повторно проверить `view_products` через `OrganizationsService`, не передавать repository доверенный `venueId` без контекста и возвращать `NotFoundException` для отсутствующей или чужой карточки.
- [ ] Описать query и response DTO в API-приложении, добавить тонкие `GET`-маршруты списка, карточки и гарниров в существующий контроллер и OpenAPI-аннотации. Не дублировать создание коктейля и не менять его входной контракт.
- [ ] Зарегистрировать read-модуль в `ProductsModule` и экспортировать публичный сервис только через `packages/backend-products/src/index.ts`.
- [ ] Выполнить `pnpm api:generate`, затем форматировать только затронутые файлы и выполнить lint затронутых backend workspace. Не выполнять тесты, `typecheck`, запуск сервера или браузерную проверку.

### 2. Создать composable данных и тонкие маршруты коктейлей

**Файлы:**

- Создать: `apps/web/app/features/cocktails/composables/useCocktails.ts`
- Создать: `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/cocktails/index.vue`
- Создать: `apps/web/app/pages/app/companies/[companyId]/venues/[venueId]/cocktails/[cocktailId].vue`
- Изменить: `apps/web/app/features/workspace/components/WorkspaceShell.vue`

**Интерфейсы:**

- `useCocktails(companyId, venueId)` возвращает query списка, query карточки, `createCocktail(input)` и методы инвалидации ключей `cocktail-list` и `cocktail-card`.
- Маршрут списка: `/app/companies/:companyId/venues/:venueId/cocktails`.
- Маршрут карточки: `/app/companies/:companyId/venues/:venueId/cocktails/:cocktailId`.

- [ ] Использовать сгенерированные методы API и `requestApi`, передавать cookie и CSRF для записи тем же способом, что `useVenueTeam`.
- [ ] Привязать ключи TanStack Query к компании, заведению, поисковой строке и ID коктейля; после успешного создания инвалидировать только список текущего заведения и карточку нового коктейля.
- [ ] Добавить «Коктейли» в существующую навигацию `WorkspaceShell` как доступный всем с `view_products` раздел; не добавлять пункты будущих заготовок, гарниров или архива.
- [ ] Оставить обе страницы тупыми контейнерами, импортирующими только экран соответствующего сценария feature-модуля.
- [ ] Форматировать затронутые файлы и выполнить lint web workspace. Не запускать тесты, `typecheck`, dev-сервер или браузер.

### 3. Реализовать список и карточку технологической карты

**Файлы:**

- Создать: `apps/web/app/features/cocktails/components/CocktailListScreen.vue`
- Создать: `apps/web/app/features/cocktails/components/CocktailCardScreen.vue`
- Создать: `apps/web/app/features/cocktails/README.md`

**Интерфейсы:**

- `CocktailListScreen` получает контекст рабочего пространства и использует `useCocktails`.
- `CocktailCardScreen` получает маршрутный `cocktailId` и использует `useCocktails`.
- Обе экранные компоненты оборачиваются в существующий `WorkspaceShell`, как `TeamPageScreen`; они не меняют оболочку.

- [ ] В списке показать компактные desktop-строки и мобильные карточки с одинаковыми полями: название, краткий состав и дата изменения. Поиск по названию выполняется после ввода, без фильтров, сортировок и URL-состояния.
- [ ] Сделать строку/карточку ссылкой на постоянный URL техкарты. Показать отдельные состояния загрузки, ошибки и пустого списка; в пустом состоянии предложить создание только пользователю с `manage_products`.
- [ ] В карточке вывести название, тип и состояние, состав, гарниры, технологию, фактический выход и комментарий только при наличии. Не рисовать заготовленные кнопки редактирования, архива, удаления, истории или выгрузки.
- [ ] Использовать PrimeVue и компактные существующие токены интерфейса; пользовательские тексты — на русском. Описать ответственность feature-модуля и маршруты в README.
- [ ] Форматировать затронутые файлы и выполнить lint web workspace. Не запускать тесты, `typecheck`, dev-сервер или браузер.

### 4. Реализовать Drawer создания коктейля и строки состава

**Файлы:**

- Создать: `apps/web/app/features/cocktails/components/CocktailFormDrawer.vue`
- Создать: `apps/web/app/features/cocktails/components/CocktailComponentRows.vue`
- Изменить: `apps/web/app/features/cocktails/components/CocktailListScreen.vue`
- Изменить: `apps/web/app/features/cocktails/composables/useCocktails.ts`
- Изменить: `apps/web/app/features/products/components/IngredientSelector.vue`
- Изменить: `apps/web/app/features/products/composables/useProductSearch.ts`

**Интерфейсы:**

- `CocktailFormDrawer` принимает `companyId`, `venueId`, `visible`, возвращает `update:visible` и `created: [cocktailId: string]`.
- `CocktailComponentRows` редактирует VeeValidate-массив строк `{ productId, unitId, amount }` и не выполняет HTTP-запросы кроме переданного выбора ингредиента.
- Форма отправляет существующий `CreateCocktailDto` без ручного изменения сгенерированных типов.

- [ ] Собрать форму PrimeVue, VeeValidate и Zod с обязательными: название, минимум одна строка состава, положительное количество и единица, бокал, лёд, метод приготовления, технология. Это соответствует обязательным полям `PRODUCT_MODEL.md`; гарниры, комментарий и фактический выход остаются необязательными.
- [ ] Получать единицы и справочники через существующий маршрут `references`, компоненты — через `IngredientSelector` и поиск `COMPONENT`, а гарниры — через отдельный scoped-маршрут гарниров текущего заведения.
- [ ] Расположить общую и серверную ошибку сохранения вверху Drawer; показать ошибки валидации около соответствующих полей. При API-ошибке не закрывать Drawer и не заменять значения формы.
- [ ] На desktop открыть `Drawer` справа, на мобильном — во весь экран. При закрытии с изменёнными данными запросить подтверждение потери ввода; при пустой форме закрывать сразу.
- [ ] После успешного создания закрыть Drawer, инвалидировать список, перейти на постоянный адрес новой карточки и не оставлять кнопку в состоянии загрузки.
- [ ] Показать действие создания только при `workspace.permissions.includes("manage_products")`; серверный POST остаётся окончательной проверкой.
- [ ] Форматировать затронутые файлы и выполнить lint web workspace. Не запускать тесты, `typecheck`, dev-сервер или браузер.

### 5. Добавить создание временного ингредиента из формы и завершить документацию

**Файлы:**

- Создать: `apps/web/app/features/cocktails/components/LocalIngredientCreateForm.vue`
- Изменить: `apps/web/app/features/cocktails/components/CocktailFormDrawer.vue`
- Изменить: `apps/web/app/features/cocktails/components/CocktailComponentRows.vue`
- Изменить: `apps/web/app/features/cocktails/README.md`
- Изменить: `docs/plans/2026-10-12-stage-7-cocktails-first-slice.md`

**Интерфейсы:**

- `LocalIngredientCreateForm` принимает контекст заведения, отображается только из строки состава и эмитит созданную карточку `{ id, name, venueId, type }`.
- После эмита `CocktailComponentRows` присваивает ингредиент текущей строке; пользователь остаётся в открытом Drawer коктейля.

- [ ] Реализовать короткую вложенную форму временного ингредиента на существующем `POST .../products/ingredients`: название, категория и необязательные базовые атрибуты. Не создавать отдельный маршрут, экран каталога или ручной экран сопоставления.
- [ ] При успехе выбрать новую карточку в исходной строке состава и вернуть фокус к заполнению коктейля. При ошибке показать её внутри вложенной формы и сохранить её ввод.
- [ ] Проверить, что shortcut доступен лишь при `manage_products`, так как создание временного ингредиента меняет данные.
- [ ] Обновить README feature-модуля: границы компонентов, зависимость от `features/products`, ключи TanStack Query, порядок штатной API-генерации и факт, что страницы не содержат логики.
- [ ] Отметить фактически изменённые файлы, выполненные и невыполненные проверки в этом плане. Форматировать изменённые файлы, выполнить разрешённые lint и `git diff --check`.

## Ожидаемые изменения документации

- `docs/plans/2026-10-12-stage-7-cocktails-first-slice.md` — статус выполнения, изменённые файлы, проверки и итог независимого ревью.
- `apps/web/app/features/cocktails/README.md` — назначение первого среза, границы компонентов и данные, которыми он владеет.
- `packages/backend-products/README.md` — дополнить только если новый read-модуль меняет уже описанную структуру пакета.

Предметные документы и `MVP_SCOPE.md` не меняются: план реализует уже утверждённые правила, а не создаёт новые.

## Не входит

- Создание, редактирование или самостоятельные разделы заготовок и гарниров.
- Редактирование, архивирование, восстановление, удаление, история, аудит в UI и выгрузка коктейлей.
- Редизайн CRM-оболочки, работа над будущей боковой навигацией и неработающие элементы будущих функций.
- Поиск по всему рабочему пространству, расширенные фильтры, сортировка и хранение запроса в URL.
- Новые тесты, тестовая инфраструктура и тестовые зависимости.

## Критерии готовности

- Список и прямой URL карточки раскрывают только активные коктейли текущего заведения.
- Пользователь с `manage_products` создаёт коктейль в Drawer с валидным составом, гарнирами и технологией, а результат открывается на собственной странице.
- Выбор ингредиентов использует существующий scoped-поиск; временный локальный ингредиент возвращается в исходную строку состава.
- Ошибки сохранения не закрывают и не очищают форму, а общая ошибка видна наверху Drawer.
- В код не попадают будущие экраны и неработающие действия; страницы остаются тонкими контейнерами.

## Фактический результат реализации

### Изменённые области

- Добавлен backend read-модуль `packages/backend-products/src/cocktails/` для списка, карточки и
  гарниров текущего заведения; он повторно проверяет `view_products` и возвращает одинаковую
  недоступность для чужого либо неактивного коктейля.
- В `apps/backend/src/products/` добавлены три GET-маршрута и OpenAPI DTO; существующий POST
  создания коктейля сохранён без изменения входного контракта.
- Штатно обновлены `packages/api-client/openapi.json` и generated API-клиент.
- Добавлен изолированный frontend-модуль `apps/web/app/features/cocktails/`, тонкие маршруты
  списка и карточки, пункт «Коктейли» в существующей навигации и нужные PrimeVue-компоненты.
- Создание реализовано в правом Drawer для desktop и полноэкранном Drawer на мобильных; общая
  ошибка находится вверху формы, а временный локальный ингредиент создаётся только внутри строки
  состава.
- Обновлены README frontend-модуля и backend-пакета.

### Выполненные проверки

- `pnpm api:generate` — успешно; перед генерацией штатно собраны backend-пакеты и экспортирована
  актуальная OpenAPI-схема.
- `pnpm exec prettier --write <только затронутые файлы>` — успешно.
- `pnpm --filter @bartech/backend-products lint` — успешно.
- `pnpm --filter @bartech/backend lint` — успешно.
- `pnpm --filter @bartech/web lint` — успешно.
- `pnpm --filter @bartech/web build` — успешно.
- `git diff --check` — успешно.

### Невыполненные проверки

Не запускались unit-, integration- и e2e-тесты, `typecheck`, dev-сервер, браузерная проверка,
Docker и миграции: они не входили в разрешённый объём этой реализации.
