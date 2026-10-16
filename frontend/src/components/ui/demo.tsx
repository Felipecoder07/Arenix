"use client";
import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';

export function CalendarPreview() {
  const [selected, setSelected] = React.useState<Date | undefined>(() => new Date());
  return <Calendar selected={selected} onSelect={setSelected} />;
}
export default function Demo() { return <CalendarPreview />; }
