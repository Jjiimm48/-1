
export type View = 'month' | 'week' | 'notes';

export type DayOfWeek = 'sunday' | 'monday';

export interface Settings {
  theme: 'light' | 'dark';
  firstDayOfWeek: DayOfWeek;
}

export type CategoryId = 'work' | 'personal' | 'important' | 'travel' | 'birthday' | 'holiday';

export interface Category {
  id: CategoryId;
  name: string;
  color: string;
  darkColor: string;
}

export interface Event {
  id: string;
  title: string;
  date: string; // ISO string for date part
  time?: string; // HH:mm
  category: CategoryId;
  isReadOnly?: boolean;
}

export interface Note {
  id: string;
  content: string;
  updatedAt: string;
}
