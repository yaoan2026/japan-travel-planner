export type TabId = 'plan' | 'transport' | 'food' | 'map' | 'deals' | 'tools';

export type TagId = 'culture' | 'nature' | 'shop' | 'food' | 'view' | 'fun';

export type CityId = 'tokyo' | 'osaka' | 'kyoto' | 'nara' | 'sapporo' | 'fukuoka' | 'okinawa';

export type PaceId = 'relax' | 'normal' | 'packed';

export type MealKind = 'lunch' | 'dinner' | 'snack' | 'any';

export interface TagInfo {
  label: string;
  icon: string;
}

export interface Spot {
  n: string;
  ja: string;
  lat: number;
  lng: number;
  a: string;
  t: (TagId | 'night')[];
  d: number;
  p: number;
  fee: number;
  desc: string;
  ev?: boolean;
  full?: boolean;
}

export interface FoodItem {
  n: string;
  ja: string;
  desc: string;
  price: string;
  shops: string;
  lat: number;
  lng: number;
  a: string;
  m: MealKind;
}

export interface DayTrip {
  n: string;
  ja: string;
  lat: number;
  lng: number;
  desc: string;
}

export interface CityInfo {
  name: string;
  shortName: string;
  jaName: string;
  emoji: string;
  lat: number;
  lng: number;
  recDays: number;
  intro: string;
  airport: {
    name: string;
    ways: string[];
  };
  transit: string[];
  spots: Spot[];
  foods: FoodItem[];
  dayTrips: DayTrip[];
}

export interface IntercityRoute {
  mode: string;
  time: string;
  price: string;
  h: number;
  cost: number;
  tip: string;
}

export interface TransitPass {
  region: string;
  name: string;
  price: string;
  desc: string;
  link: string;
}

export interface DealItem {
  cat: string;
  icon: string;
  title: string;
  desc: string;
  link: string;
  tag: string;
}

export interface PhraseItem {
  zh: string;
  ja: string;
  ro: string;
  cat: string;
}

export interface TripOptions {
  cities: CityId[];
  start: string;
  days: number;
  pace: PaceId;
  interests: TagId[];
  seed: number;
}

export interface ItineraryItem {
  id: string;
  type: 'spot' | 'food' | 'move' | 'note';
  icon: string;
  time: number;
  dur: number;
  name: string;
  ja?: string;
  lat?: number;
  lng?: number;
  desc?: string;
  sub?: string;
  tags?: (TagId | 'night')[];
  cost?: number;
  city?: CityId;
  kind?: string;
}

export interface TripDay {
  date: string;
  city: CityId;
  items: ItineraryItem[];
  summary: string;
}

export interface Trip {
  id: string;
  created: number;
  title: string;
  opts: TripOptions;
  days: TripDay[];
  cost: {
    transport: number;
    tickets: number;
    food: number;
  };
  railCost: number;
  tips: string[];
  pinned?: boolean;
}

export interface UserPrefs {
  cities: CityId[];
  days: number;
  pace: PaceId;
  interests: TagId[];
}
