/**
 * FAMILY HUB — read-only Google Calendar relay
 * ---------------------------------------------------------------
 * Lets the Family Hub PWA show your Google Calendar on the month
 * grid. It only ever READS the calendar. Nothing is written back.
 *
 * SETUP (about 3 minutes):
 *  1. Go to https://script.google.com  ->  New project
 *  2. Delete the sample code, paste this whole file
 *  3. Change SHARED_TOKEN below to a long random string of your own
 *     (letters + numbers, ~30 chars). Keep a copy.
 *  4. (Optional) set CALENDAR_ID to a specific calendar's ID
 *     (Calendar settings -> "Integrate calendar" -> Calendar ID).
 *     Leave it as 'primary' for your main calendar.
 *  5. Deploy -> New deployment -> type: Web app
 *       - Description: anything
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     Click Deploy, authorise when asked, copy the Web app URL
 *     (it ends in /exec).
 *  6. In the Family Hub, open the Calendar tab -> "Sync" button,
 *     paste the URL and the same token, tap "Test & connect".
 *
 * To change the token later, edit it here and Deploy -> Manage
 * deployments -> edit -> Version: New version.
 */

const SHARED_TOKEN = 'CHANGE_ME_to_a_long_random_string';
const CALENDAR_ID  = 'primary';   // or a specific calendar ID

function doGet(e){
  const p = (e && e.parameter) || {};
  if (p.token !== SHARED_TOKEN){
    return _json({ error: 'unauthorized' });
  }

  const cal = (CALENDAR_ID === 'primary')
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(CALENDAR_ID);

  if (!cal) return _json({ error: 'calendar not found' });

  const tz    = cal.getTimeZone();
  const start = p.start ? new Date(p.start) : new Date();
  const end   = p.end   ? new Date(p.end)   : new Date(Date.now() + 86400000 * 45);

  const events = cal.getEvents(start, end).map(function (ev){
    const allDay = ev.isAllDayEvent();
    return {
      id:       ev.getId(),
      title:    ev.getTitle(),
      date:     Utilities.formatDate(ev.getStartTime(), tz, 'yyyy-MM-dd'),
      time:     allDay ? '' : Utilities.formatDate(ev.getStartTime(), tz, 'HH:mm'),
      endDate:  Utilities.formatDate(ev.getEndTime(), tz, 'yyyy-MM-dd'),
      allDay:   allDay,
      location: ev.getLocation() || '',
      notes:    ev.getDescription() || ''
    };
  });

  return _json({ events: events });
}

function _json(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
