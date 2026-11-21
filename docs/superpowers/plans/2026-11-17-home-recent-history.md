# План: последние изменения на главной

**Статус:** реализация завершена; lint и сборка web-пакета прошли. Тесты и визуальная проверка не
запускались.

## Область изменений

- `apps/web/app/features/history/composables/useAuditHistory.ts` — разрешить экрану главной запрашивать
  события без дополнительного запроса списка авторов.
- `apps/web/app/features/workspace/components/RecentAuditEvents.vue` — компактный список до трёх
  последних действий со штатными состояниями.
- `apps/web/app/features/workspace/components/VenueHomeScreen.vue` — разместить блок под личными
  задачами.
- `apps/web/app/features/workspace/README.md`, `UI_AND_NAVIGATION.md` — описать новую секцию и источник
  данных.

## Шаги

- [x] Переиспользовать `useAuditHistory` с первой страницей истории и текущими ограничениями доступа.
- [x] Вывести не более трёх записей: краткое резюме, время и автора; добавить загрузку, ошибку и пустое
      состояние.
- [x] Вставить блок после задач и обновить документацию.
- [x] Форматировать изменённые файлы Prettier, выполнить целевой ESLint, сборку web-пакета и
      `git diff --check`.

## Образцы интерфейса

- `apps/web/app/features/history/components/HistoryScreen.vue` — подписи и формат времени.
- `apps/web/app/features/workspace/components/TodayShiftRoster.vue` и
  `MyVenueReminders.vue` — карточка, заголовок, иконка и компактные состояния.
