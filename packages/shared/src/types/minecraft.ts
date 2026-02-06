export interface MinecraftBlock {
  name: string;
  displayName: string;
  id: number;
  hardness: number;
  stackSize: number;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface BotState {
  position: Position;
  health: number;
  food: number;
  inventory: InventoryItem[];
  nearbyPlayers: string[];
  currentActivity?: string;
}

export interface InventoryItem {
  name: string;
  count: number;
  slot: number;
}

export type BlockName = string;
export type ItemName = string;
