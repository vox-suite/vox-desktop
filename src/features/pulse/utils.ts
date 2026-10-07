export class LatestRequest {
  private generation = 0;
  start() {
    return ++this.generation;
  }
  isCurrent(ticket: number) {
    return ticket === this.generation;
  }
  cancel() {
    this.generation++;
  }
}

export function uniqueCharts<T extends { id: string }>(charts: T[]): T[] {
  return [...new Map(charts.map((chart) => [chart.id, chart])).values()];
}
