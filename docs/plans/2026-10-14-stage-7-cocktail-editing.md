# План реализации: редактирование коктейля

> **Для агентных исполнителей:** обязательно использовать
> `superpowers:subagent-driven-development` (предпочтительно) или
> `superpowers:executing-plans` для последовательного выполнения задач. Шаги
> используют флажки `- [ ]`.

**Цель:** дать пользователю с `manage_products` возможность атомарно изменить
коктейль через Drawer на странице его техкарты.

**Архитектура:** backend получает отдельный `PATCH`-маршрут и передаёт входные
данные в узкий сценарий обновления `ProductsService`. Сервис повторно применяет
правила создания, но обновляет одну принадлежащую текущему заведению карточку в
транзакции. Во frontend существующий `CocktailFormDrawer` получает явный режим
создания или редактирования и не дублирует поля, валидацию или строки состава.

**Стек:** NestJS, Prisma/PostgreSQL, OpenAPI + Orval, Nuxt 4, Vue 3, PrimeVue,
VeeValidate, Zod, TanStack Query, pnpm.

**Спецификация:**
`docs/specs/2026-10-14-stage-7-cocktail-editing-design.md`

## Общие ограничения

- Не изменять generated API-клиент вручную: после изменения OpenAPI выполнять
  только `pnpm api:generate`.
- Фронтенд импортирует типы только через публичный корень `@bartech/api-client`
  и публичные aliases операций; не импортировать внутренний `generated/models`.
- Проверки права и области данных выполняются на сервере повторно; скрытие
  кнопки во frontend не является проверкой доступа.
- Страницы Nuxt остаются тонкими контейнерами; бизнес-логика живёт в
  `features/cocktails` и backend-модуле продукции.
- Не добавлять архив, удаление, версии, черновики, интерфейс конфликтов,
  редактирование заготовок и гарниров.
- Не создавать и не запускать тесты без отдельного согласования владельца
  продукта. Выполнить только разрешённые статические проверки.
- Не выполнять коммит, push, запуск сервера, браузера, Docker, миграций или
  build без отдельной команды владельца продукта.

## Фокус ревью

- Подмена `companyId`, `venueId` или `cocktailId` не должна позволить изменить
  карточку другого заведения и не должна раскрывать её существование.
- Замена состава и гарниров должна быть атомарной: ошибка проверки или базы не
  оставляет частично обновлённые связи.
- Повторное сохранение старой формы разрешено по правилу «последнее успешное
  сохранение становится актуальным», без неявного слияния массивов.
- Компонент или гарнир из чужого заведения, глобальная не-ингредиентная запись
  и недоступная единица должны отклоняться теми же правилами, что при создании.
- Неуспешный API-ответ не закрывает Drawer и не изменяет карточку, уже
  отображаемую на странице.

## Структура изменений

| Путь                                                                | Ответственность                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/backend/src/products/products.dto.ts`                         | Входной DTO и OpenAPI-аннотации обновления коктейля.                      |
| `apps/backend/src/products/products.controller.ts`                  | Тонкий защищённый PATCH-маршрут.                                          |
| `packages/backend-products/src/products.service.ts`                 | Проверка доступа, предметных правил и транзакционный сценарий обновления. |
| `packages/backend-products/src/products.repository.ts`              | Scoped-чтение целевой карточки и атомарная замена её данных/связей.       |
| `apps/web/app/features/cocktails/composables/useCocktails.ts`       | Мутация обновления и обновление query-ключей.                             |
| `apps/web/app/features/cocktails/components/CocktailFormDrawer.vue` | Единая форма создания/редактирования.                                     |
| `apps/web/app/features/cocktails/components/CocktailCardScreen.vue` | Кнопка редактирования и координация Drawer на карточке.                   |
| `apps/web/app/features/cocktails/README.md`                         | Назначение режима редактирования и границы модуля.                        |
| `docs/plans/2026-10-14-stage-7-cocktail-editing.md`                 | Итоговый статус, файлы и проверки.                                        |

## Задача 1: Контракт и атомарный backend-сценарий обновления

**Файлы:**

- Изменить: `apps/backend/src/products/products.dto.ts`
- Изменить: `apps/backend/src/products/products.controller.ts`
- Изменить: `packages/backend-products/src/products.service.ts`
- Изменить: `packages/backend-products/src/products.repository.ts`

**Использует:** существующие `CreateCocktailDto`, `CocktailInput`,
`createComposite`, `findAllowedProducts`, `findAllowedUnits`,
`findAvailableReferenceValueById`, `lockPreparationGraph` и правила из
`product-rules.ts`.

**Даёт следующей задаче:** публичную OpenAPI-операцию
`PATCH /companies/:companyId/venues/:venueId/products/cocktails/:cocktailId`
с телом, эквивалентным `CreateCocktailDto`, и успешным ответом
`ProductCreatedDto` либо актуальным минимальным DTO обновлённой карточки.

- [x] Добавить `UpdateCocktailDto` как явный DTO без доверенного поля типа или
      области данных. Допускается переиспользовать структуру полей
      `CreateCocktailDto`, если это не ухудшает OpenAPI-документацию.
- [x] Добавить тонкий PATCH-маршрут в `ProductsController`: извлечь текущего
      пользователя, контекст и `cocktailId`, объявить `@RequirePermissions("manage_products")`,
      описать успешные, валидационные, конфликтные и недоступные ответы.
- [x] Добавить в `ProductsService` метод
      `updateCocktail(context: CreateProductContext, cocktailId: string, input: CocktailInput)`.
      Он проверяет право, находит активный коктейль строго в `context.venueId`,
      проверяет справочники и применяет все существующие правила создания.
- [x] Выделить минимальные repository-операции: scoped-поиск обновляемого
      коктейля и транзакционная замена полей `Product`, строк `ProductComponent` и
      связей `CocktailGarnish`. В транзакции сначала валидировать все ссылки, затем
      заменить наборы; `updatedByUserId` и `updatedAt` должны обновиться.
- [x] Сохранить правило последнего успешного сохранения: не вводить ревизии,
      optimistic-locking, скрытое слияние массива или подтверждение конфликта.
- [x] Вручную статически проверить пять пунктов «Фокус ревью» по коду и
      запросам repository; автоматические тесты не создавать без разрешения.

## Задача 2: Генерация публичного API-контракта и клиентская мутация

**Файлы:**

- Изменить: сгенерированные файлы `packages/api-client/src/generated/` — только
  результатом штатной генерации;
- Изменить: `apps/web/app/features/cocktails/composables/useCocktails.ts`

**Использует:** публичную PATCH-операцию из задачи 1 и её export из
`@bartech/api-client`.

**Даёт следующей задаче:**
`updateCocktail(cocktailId, input)` с типом тела из публичного operation alias;
после успеха обновляются query-ключи списка и текущей карточки.

- [x] Запустить `pnpm api:generate` после готовности backend-контракта. Не
      редактировать generated-файлы вручную и не менять генератор.
- [x] Добавить в `useCocktails` точный тип обновления из публичного alias
      операции и функцию `updateCocktail(cocktailId, input)` с CSRF-обновлением,
      `requestApi` и инвалидацией `cocktail-list` и `cocktail-card`.
- [x] Убедиться, что существующие ключи карточки включают `companyId`, `venueId`
      и `cocktailId`, поэтому обновление одного коктейля не делает данные другого
      заведения актуальными по ошибке.
- [x] Проверить, что frontend не заменяет сохранённые данные оптимистично до
      успешного ответа API.

## Задача 3: Единый Drawer и действие на карточке

**Файлы:**

- Изменить: `apps/web/app/features/cocktails/components/CocktailFormDrawer.vue`
- Изменить: `apps/web/app/features/cocktails/components/CocktailCardScreen.vue`
- Изменить: `apps/web/app/features/cocktails/README.md`

**Использует:** чтение карточки и `updateCocktail` из задачи 2.

**Даёт результат:** пользователь с `manage_products` изменяет коктейль в
Drawer и после сохранения остаётся на обновлённой странице техкарты.

- [x] Добавить в `CocktailFormDrawer` явные входы режима (`create` или `edit`)
      и исходной карточки. Инициализировать все поля из карточки только при
      открытии режима редактирования; режим создания сохранить без изменения
      поведения.
- [x] Переиспользовать существующие VeeValidate/Zod-правила, строки состава,
      выбор гарниров, справочники, обработку грязной формы и верхнее сообщение об
      общей ошибке. Не создавать вторую форму или отдельную страницу редактирования.
- [x] В режиме редактирования отправлять `updateCocktail`, закрывать Drawer
      только после успеха и эмитить событие `updated`. При серверной ошибке Drawer
      остаётся открыт, введённые значения сохраняются.
- [x] На `CocktailCardScreen` вычислить `canManage` из текущего workspace,
      показать «Редактировать» только при праве и передать загруженную карточку в
      Drawer. После `updated` дождаться обновления query карточки; маршрут и
      положение пользователя не менять.
- [x] Обновить `features/cocktails/README.md` на русском: один Drawer владеет
      созданием и редактированием, а зависимости для заготовок/гарниров не входят
      в этот срез.

## Задача 4: Статические проверки, документация и независимое ревью

**Файлы:**

- Изменить: `docs/plans/2026-10-14-stage-7-cocktail-editing.md`

- [x] Отформатировать изменённые исходные и документационные файлы штатным
      Prettier.
- [x] Выполнить `pnpm --filter @bartech/web lint`.
- [x] Выполнить `pnpm --filter @bartech/web typecheck`.
- [x] Выполнить `git diff --check`.
- [x] Зафиксировать в конце этого плана фактически изменённые файлы, точные
      результаты проверок и отдельно отмечать непроведённые runtime-проверки.
- [ ] Передать готовый срез независимому ревьюеру. Он проверяет tenant-изоляцию,
      атомарность замены состава/гарниров, public API aliases, отсутствие
      дублированной формы и соблюдение согласованных границ.

## Самопроверка плана

- Все требования спецификации покрыты: право и tenant-изоляция — задача 1;
  атомарность — задача 1; публичный API-контракт — задача 2; Drawer и
  пользовательский сценарий — задача 3; проверки и ревью — задача 4.
- В плане нет неразрешённых тестов, запуска приложения, Docker, миграций или
  commit/push.
- Имена `updateCocktail`, `UpdateCocktailDto`, `cocktail-list` и
  `cocktail-card` одинаково использованы во всех зависимых задачах.
- Указанные в «Фокусе ревью» риски закреплены проверками задач 1–4.

## Итог реализации

Статус: выполнено, ожидает независимого ревью.

### Изменённые файлы

- `apps/backend/src/products/products.dto.ts` — DTO обновления и технические идентификаторы
  для предзаполнения формы карточки.
- `apps/backend/src/products/products.controller.ts` — защищённый PATCH-маршрут коктейля.
- `packages/backend-products/src/products.service.ts` — проверяемый сценарий обновления в
  транзакции.
- `packages/backend-products/src/products.repository.ts` — scoped-поиск коктейля и атомарная
  замена его полей, состава и гарниров.
- `packages/backend-products/src/cocktails/cocktail-read.dto.ts` и
  `packages/backend-products/src/cocktails/cocktail-read.repository.ts` — идентификаторы
  компонентов, единиц и справочников в карточке для режима редактирования.
- `packages/api-client/openapi.json` и `packages/api-client/src/generated/` — обновлены только
  штатной командой `pnpm api:generate`.
- `apps/web/app/features/cocktails/composables/useCocktails.ts` — мутация изменения и
  инвалидация списка и карточки.
- `apps/web/app/features/cocktails/components/CocktailFormDrawer.vue` — единый Drawer для
  создания и редактирования.
- `apps/web/app/features/cocktails/components/CocktailCardScreen.vue` — действие
  «Редактировать» и обновление карточки после сохранения.
- `apps/web/app/features/cocktails/components/CocktailListScreen.vue` — явный режим создания.
- `apps/web/app/features/cocktails/README.md` — границы и ответственность модуля.

### Выполненные проверки

- `pnpm api:generate` — успешно; команда пересобрала backend, экспортировала OpenAPI и
  сгенерировала API-клиент.
- `pnpm --filter @bartech/web lint` — успешно, без предупреждений.
- `pnpm --filter @bartech/web typecheck` — успешно.
- `git diff --check` — успешно, ошибок пробелов нет.

### Непроведённые проверки

По согласованным ограничениям не запускались сервер, браузер, Docker, миграции, build и тесты.
Пользовательский сценарий Drawer и запрос PATCH требуют отдельной runtime-проверки владельцем
продукта.
