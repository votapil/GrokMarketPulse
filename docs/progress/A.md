T-12 взял
T-12 готово
T-37 взял
T-09 взял
T-11 взял
T-07 взял
T-13 взял
T-37 готово
T-09 готово
T-11 готово
T-07 готово
T-13 готово
T-05 принято
T-15 взял
T-15: контракт — PulseScreen
T-14 взял
T-18 взял
T-20 взял
T-05: контракт принято
T-06 принято
T-08 принято
T-14 готово
T-18 готово
T-05 принято
T-10 принято
T-04 принято
T-17 принято
T-19 принято
T-20 готово
T-15 готово
T-16 принято
T-08/firecrawl maxAge принято
T-15 возврат закрыт: убраны двойные aside

## Волна 1, динамический слой

T-27 готово — layout.build: Grok выбирает только типы блоков, props собирает
  сервер из настоящих id; неизвестные типы и дубли режутся до записи; потолок 6.
  Вызов поставлен в конец assess.run (состав блоков зависит от assessment).
T-29 готово — chat.ask через scheduler, uiEvents.send пишет скрытое system-сообщение
  и пересобирает layout. Разобраны edit_plan_price, toggle_filter, update_radius,
  select_signal; неизвестное действие не роняет петлю.
T-30 готово — ChatPanel: история, три чипа, скелетон, system-сообщения скрыты.
T-32 готово — DataGrid с inline-правкой своей цены + FeatureMatrix.
T-39 готово — CompanyBar: одно предзаполненное поле + плашка контекста.
T-37 дополнено — на канвасе Wonder привязаны токены ко всем шести блокам A,
  get_element_code теперь отдаёт вставляемый код; из DESIGN-BLOCKS.md убраны
  протухающие data-node-id.

Сборка зелёная: tsc по обоим проектам и npm run build.

## Ответ дорожке B

S-1 на api.workspace.setupWatchlist — подтверждаю. Проверил: в competitors
и sources сейчас пишет только seed.ts, добавить конкурента из интерфейса нельзя
в принципе. Файл твой, схема не меняется, останавливаться не нужно.

Закрывать дыру у себя в onboarding.analyze не буду: у этих таблиц должен остаться
один писатель, второй клиент придёт скоро — discovery.ts (T-35). Дублирование даст
две нормализации URL и две дедупликации.

Просьбы к setupWatchlist:
- сделать заодно internalMutation с той же логикой — позову из onboarding.analyze.
  Сейчас analyze принимает competitorUrls и молча игнорирует их («N competitor URLs
  noted» в run, строк нет). Это тихий отказ, хочу закрыть без дубля.
- идемпотентность по нормализованному URL; возврат competitorId и sourceId;
  origin проставляет вызывающий (manual / exa / grok); валидация URL на входе;
  пустой список — no-op, не ошибка.

Ещё нужен публичный api.snapshots.latest: в snapshots.ts только internalQuery,
поэтому FeatureMatrix берёт фичи конкурента из кэш-фикстуры.

До начала T-35: пусть discovery возвращает признак совпадения ниши/товара и
географию (регион или расстояние) — иначе галочку only same products и радиус
в T-40 нечем питать.

Занятые файлы A: convex/layout.ts chat.ts uiEvents.ts history.ts assess.ts,
src/components/blocks/**, ChatPanel.tsx CompanyBar.tsx ActionPanel.tsx,
src/screens/PulseScreen.tsx.
