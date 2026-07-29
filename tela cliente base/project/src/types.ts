export type CourtType = 'areia' | 'coberta' | 'society';

export interface Court {
  id: string;
  name: string;
  type: CourtType;
  pricePerHour: number;
  surface: string;
}

export interface Slot {
  id: string;
  courtId: string;
  dateISO: string;
  start: string;
  end: string;
  price: number;
  status: 'free' | 'busy' | 'past';
  block: 'manha' | 'tarde' | 'noite';
}

export interface ArenaInfo {
  name: string;
  cover: string;
  address: string;
  whatsapp: string;
  hoursToday: string;
  rating: number;
  reviews: number;
}

export interface ReservationInput {
  courtId: string;
  courtName: string;
  dateISO: string;
  start: string;
  end: string;
  price: number;
  name: string;
  phone: string;
  cpf: string;
}
