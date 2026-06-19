import { watchlistItems, alerts, chatMessages, type WatchlistItem, type InsertWatchlistItem, type Alert, type InsertAlert, type ChatMessage, type InsertChatMessage } from "@shared/schema";

export interface IStorage {
  // Watchlist
  getWatchlist(): Promise<WatchlistItem[]>;
  addWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeWatchlistItem(id: number): Promise<void>;

  // Alerts
  getAlerts(): Promise<Alert[]>;
  addAlert(alert: InsertAlert): Promise<Alert>;
  deleteAlert(id: number): Promise<void>;
  triggerAlert(id: number, details: { triggerPrice: number; triggeredAt: Date }): Promise<void>;

  // Chat
  getChatMessages(): Promise<ChatMessage[]>;
  addChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(): Promise<void>;
}

export class MemStorage implements IStorage {
  private watchlist: Map<number, WatchlistItem> = new Map();
  private alertsMap: Map<number, Alert> = new Map();
  private chatMsgs: Map<number, ChatMessage> = new Map();
  private watchlistId = 1;
  private alertId = 1;
  private chatId = 1;

  constructor() {
    // Seed default watchlist
    const defaults = [
      { symbol: "AAPL", name: "Apple Inc." },
      { symbol: "MSFT", name: "Microsoft Corp." },
      { symbol: "NVDA", name: "NVIDIA Corp." },
      { symbol: "TSLA", name: "Tesla Inc." },
      { symbol: "GOOGL", name: "Alphabet Inc." },
      { symbol: "AMZN", name: "Amazon.com Inc." },
      { symbol: "META", name: "Meta Platforms" },
      { symbol: "BRK-B", name: "Berkshire Hathaway" },
    ];
    defaults.forEach(d => {
      const item: WatchlistItem = { id: this.watchlistId++, symbol: d.symbol, name: d.name, addedAt: new Date() };
      this.watchlist.set(item.id, item);
    });
  }

  async getWatchlist(): Promise<WatchlistItem[]> {
    return Array.from(this.watchlist.values());
  }

  async addWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const newItem: WatchlistItem = { ...item, id: this.watchlistId++, addedAt: new Date() };
    this.watchlist.set(newItem.id, newItem);
    return newItem;
  }

  async removeWatchlistItem(id: number): Promise<void> {
    this.watchlist.delete(id);
  }

  async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alertsMap.values());
  }

  async addAlert(alert: InsertAlert): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: this.alertId++,
      triggered: false,
      triggerPrice: null,
      createdAt: new Date(),
      triggeredAt: null,
    };
    this.alertsMap.set(newAlert.id, newAlert);
    return newAlert;
  }

  async deleteAlert(id: number): Promise<void> {
    this.alertsMap.delete(id);
  }

  async triggerAlert(id: number, details: { triggerPrice: number; triggeredAt: Date }): Promise<void> {
    const alert = this.alertsMap.get(id);
    if (alert) {
      this.alertsMap.set(id, { ...alert, triggered: true, triggerPrice: details.triggerPrice, triggeredAt: details.triggeredAt });
    }
  }

  async getChatMessages(): Promise<ChatMessage[]> {
    return Array.from(this.chatMsgs.values());
  }

  async addChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const newMsg: ChatMessage = { ...msg, id: this.chatId++, createdAt: new Date() };
    this.chatMsgs.set(newMsg.id, newMsg);
    return newMsg;
  }

  async clearChatMessages(): Promise<void> {
    this.chatMsgs.clear();
  }
}

export const storage = new MemStorage();
