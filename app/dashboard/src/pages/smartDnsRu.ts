/** Только русский UI для страницы Smart DNS (без i18n / без загрузки локалей). */

export const ru = {
  title: "Балансировка Smart DNS",
  back: "Назад",
  refresh: "Обновить",
  loading: "Загрузка…",
  enabled: "ВКЛЮЧЁН",
  disabledBadge: "ВЫКЛУЧЕН",
  disabled:
    "Smart DNS выключен. Установите SMART_DNS_ENABLED=true на панели.",
  stateUp: "В норме",
  stateDown: "Недоступен",
  stateGrace: "Отсрочка",
  poolSummary: "{{up}} из {{total}} в норме",
  score: "Счёт нагрузки",
  cpu: "CPU",
  bw: "Канал",
  mbpsUnit: "Мбит/с",
  conn: "Соединения",
  connSub: "сумма активных TCP (Xray) по узлам",
  avgCpuSub: "среднее по узлам с метриками",
  avgBwSub: "среднее, Мбит/с",
  alertsLower: "предупреждения",
  noMetricsYet: "Метрики ещё не получены",
  pollErrors: "Ошибки опроса",
  totalPools: "Пулы",
  healthyNodes: "В норме",
  downNodes: "Недоступны",
  avgCpu: "CPU средн.",
  avgBw: "Канал средн.",
  allPoolsHealthy: "Все пулы в норме",
  metricsUpdated: "Обновлено {{rel}}",
  timeAgoNow: "только что",
  timeAgoSeconds: "{{n}} с назад",
  timeAgoMinutes: "{{n}} мин назад",
  timeAgoHours: "{{n}} ч назад",
  helpTitle: "Справка: что означают цифры",
  helpP1:
    "Верхние карточки — сводка по всем пулам: сколько пулов, сколько узлов в норме и сколько недоступно, сумма активных TCP-соединений из метрик нод, средний CPU и средняя скорость трафика по сети (Мбит/с).",
  helpP2:
    "Страница подтягивает данные с панели примерно каждые 4 секунды. На нодах метрики коротко кешируются — это срез «почти онлайн», не график по каждой секунде.",
  helpP3:
    "Процент у узла (значок справа в шапке карточки) — доля DNS-ответов, которую балансировка отдаёт этой ноде среди живых узлов пула. Чем выше счёт нагрузки, тем меньше доля. У недоступных — 0%.",
  helpP4:
    "Цветная полоска под названием пула — то же распределение нагрузки: длина сегмента соответствует относительному весу ноды.",
  helpP5:
    "CPU — загрузка процессора сервера ноды (%). «Канал» — текущая суммарная скорость трафика по сетевым интерфейсам ноды в Мбит/с, как присылает нода.",
  helpP6:
    "«Соединения» — число установленных TCP-соединений, связанных с процессом Xray на ноде. Это не то же самое, что «число людей»: у одного клиента может быть несколько соединений.",
  helpP7:
    "Счёт нагрузки: соединения + канал×SMART_DNS_SCORE_BW_MULT + CPU×SMART_DNS_SCORE_CPU_MULT (в .env панели по умолчанию 0.7 и 0.5). Вес в выборе DNS: 1/(1+счёт) — более загруженной ноде реже достаётся ответ.",
  helpP8:
    "«В норме» — метрики в порядке и узел проходит проверки. «Отсрочка» — были сбои опроса, но ещё действует запас по времени. «Недоступен» — узел нездоров или слишком много ошибок подряд.",
  pollerDead: "Поллер метрик не работает — данные устарели",
  pollerDeadHint:
    "Смотрите логи панели: TLS, занятость порта 53. После исправления перезапустите панель. В свежих сборках поллер метрик может продолжать работу, даже если DNS на :53 не поднялся.",
  noData:
    "Нет пулов. Задайте FQDN на узлах и включите SMART_DNS_ENABLED.",
} as const;

export function tr(
  template: string,
  vars: Record<string, string | number> = {}
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{{${k}}}`
  );
}

export function timeAgoRu(seconds: number): string {
  if (seconds < 5) return ru.timeAgoNow;
  if (seconds < 60) return tr(ru.timeAgoSeconds, { n: Math.round(seconds) });
  if (seconds < 3600)
    return tr(ru.timeAgoMinutes, { n: Math.round(seconds / 60) });
  return tr(ru.timeAgoHours, { n: Math.round(seconds / 3600) });
}
