type NumericValue = number | string | { toFixed: (digits: number) => string; toNumber?: () => number };

/**
 * Convierte un string de hora formato "HH:MM" a un objeto `Date` representativo
 * requerido por Prisma para columnas de tipo `@db.Time`.
 *
 * En PostgreSQL, una columna `TIME` almacena únicamente hora, minuto y segundo.
 * Prisma mapea este tipo con un objeto `Date` fijando la fecha base estándar UTC 1970-01-01.
 */
export function parseTimeStringToDate(timeString: string): Date {
  const baseDateString = "1970-01-01T";
  return new Date(`${baseDateString}${timeString}:00.000Z`);
}

/**
 * Formatea una fecha o Date para visualización de hora (HH:mm) en formato UTC.
 */
export function formatTime(fecha: Date | string): string {
  return new Date(fecha)
    .toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Argentina/Buenos_Aires",
    })
    .replace(/\u00A0/g, " ");
}

/**
 * Formatea una fecha ISO o Date para visualización legible ("lunes 15 de marzo de 2026").
 */
export function formatDate(value: string | Date): string {
  const dateObj = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateObj);
}

/**
 * Formatea una fecha ISO o Date en formato compacto DD/MM/AAAA, apto para
 * documentos impresos donde el espacio horizontal es limitado.
 */
export function formatDateShort(value: string | Date): string {
  const dateObj = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateObj);
}

/**
 * Formatea montos monetarios en moneda argentina (ARS).
 */
export function formatFare(value: NumericValue): string {
  const numValue =
    typeof value === "number"
      ? value
      : typeof (value as { toNumber?: () => number }).toNumber === "function"
      ? (value as { toNumber: () => number }).toNumber()
      : Number(value);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  })
    .format(numValue)
    .replace(/[\u00A0\u202F]/g, " ");
}

/**
 * Obtiene el día de la semana ISO (1 = Lunes, ..., 7 = Domingo) a partir de una fecha UTC.
 */
export function getIsoWeekday(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/**
 * Genera el listado de fechas UTC comprendidas entre `desde` y `hasta`
 * que coincidan con los días de la semana especificados en `diasSemana` (1=Lunes .. 7=Domingo).
 */
export function generarFechasPorDias(
  desde: Date,
  hasta: Date,
  diasSemana: number[]
): Date[] {
  const diasSet = new Set(diasSemana);
  const fechas: Date[] = [];

  // Normalizar a inicio de día UTC (00:00:00.000Z)
  const current = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  const end = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate()));

  while (current <= end) {
    const weekday = getIsoWeekday(current);
    if (diasSet.has(weekday)) {
      fechas.push(new Date(current.getTime()));
    }
    // Avanzar 1 día
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return fechas;
}
