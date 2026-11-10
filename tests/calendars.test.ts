import { describe, expect, it } from 'vitest';
import { CalendarError, parseIcs } from '../src/lib/calendars';
import { parseIso } from '../src/planner';

const ics = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;
const ev = (lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
const [from, to] = [parseIso('2027-01-01'), parseIso('2027-12-31')];

describe('ICS import', () => {
  it('reads all-day, timed and multi-day entries', () => {
    const { events } = parseIcs(
      ics(
        [
          ev(['DTSTART;VALUE=DATE:20270605', 'DTEND;VALUE=DATE:20270620', 'SUMMARY:Costa Rica']),
          ev(['DTSTART;TZID=Europe/Berlin:20270213T153000', 'DTEND;TZID=Europe/Berlin:20270213T171500', 'SUMMARY:Hertha\\, BSC – Union']),
          ev(['DTSTART:20270930T223000Z', 'SUMMARY:Konzert spät']),
          ev(['DTSTART;VALUE=DATE:20270314', 'DTEND;VALUE=DATE:20270315', 'SUMMARY:Ein langer Titel der über', '  mehrere Zeilen geht']),
          ev(['DTSTART;VALUE=DATE:20260101', 'SUMMARY:Vorjahr']),
        ].join('\r\n'),
      ),
      from, to, 'ics:test',
    );
    expect(events).toEqual([
      { start: '2027-02-13', label: 'Hertha, BSC – Union', source: 'ics:test' },
      { start: '2027-03-14', label: 'Ein langer Titel der über mehrere Zeilen', source: 'ics:test' },
      { start: '2027-06-05', end: '2027-06-19', label: 'Costa Rica', source: 'ics:test' },
      // 22:30 UTC is already the next day in Berlin
      { start: '2027-10-01', label: 'Konzert spät', source: 'ics:test' },
    ]);
  });

  it('repeats yearly entries and skips more frequent ones', () => {
    const { events, skipped } = parseIcs(
      ics([ev(['DTSTART;VALUE=DATE:19840314', 'RRULE:FREQ=YEARLY', 'SUMMARY:Oma Inge']), ev(['DTSTART;VALUE=DATE:20270104', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Müll'])].join('\r\n')),
      from, to, 's',
    );
    expect(events).toEqual([{ start: '2027-03-14', label: 'Oma Inge', source: 's' }]);
    expect(skipped).toBe(1);
  });

  it('rejects something that is not a calendar', () => {
    expect(() => parseIcs('<html>nope</html>', from, to, 's')).toThrow(CalendarError);
  });
});
