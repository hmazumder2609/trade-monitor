interface AlertCheck {
  condition: "above" | "below";
  price: number;
}

interface QuoteCheck {
  symbol: string;
  price: number;
}

interface StoredAlert extends AlertCheck {
  id: number;
  symbol: string;
  triggered: boolean;
}

export function evaluateAlertTrigger(alert: AlertCheck, quote: QuoteCheck) {
  const triggered = alert.condition === "above"
    ? quote.price >= alert.price
    : quote.price <= alert.price;

  return {
    triggered,
    triggerPrice: triggered ? quote.price : null,
  };
}

export function evaluateAlerts(alerts: StoredAlert[], quotes: QuoteCheck[]) {
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol.toUpperCase(), quote]));

  return alerts.flatMap((alert) => {
    if (alert.triggered) return [];
    const quote = quoteBySymbol.get(alert.symbol.toUpperCase());
    if (!quote) return [];

    const result = evaluateAlertTrigger(alert, quote);
    if (!result.triggered || result.triggerPrice === null) return [];

    return [{
      id: alert.id,
      symbol: alert.symbol,
      triggerPrice: result.triggerPrice,
    }];
  });
}
