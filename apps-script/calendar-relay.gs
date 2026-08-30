/**
 * FAMILY HUB — read-only Google Calendar relay  (v2)
 * ---------------------------------------------------------------
 * Lets the Family Hub PWA show your Google Calendar(s) on the
 * month grid. It only ever READS. Nothing is written back.
 *
 * SETUP (about 3 minutes):
 *  1. https://script.google.com  ->  New project
 *  2. Delete the sample code, paste this whole file
 *  3. Change SHARED_TOKEN to a long random string of your own
 *  4. Deploy -> New deployment -> Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     Deploy, authorise, copy the Web app URL (ends in /exec)
 *  5. Family Hub -> Settings -> Synced calendars -> paste URL + token
 *
 * v2 adds ?list=1 (enumerate calendars) and ?cals=id1,id2
 * (limit which calendars are returned). If you deployed v1,
 * redeploy this: Deploy -> Manage deployments -> edit -> New version.
 */

const SHARED_TOKEN = 'CHANGE_ME_to_a_long_random_string';

function doGet(e){
  const p = (e && e.parameter) || {};
  if (p.token !== SHARED_TOKEN) return _json({ error: 'unauthorized' });

  // ?list=1  ->  the calendars this account can see
  if (p.list){
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const cals = CalendarApp.getAllCalendars().map(function (c){
      var count = 0;
      try { count = c.getEvents(monthStart, monthEnd).length; } catch (err) {}
      return {
        id: c.getId(),
        name: c.getName(),
        color: c.getColor(),
        primary: c.isMyPrimaryCalendar(),
        eventsThisMonth: count
      };
    });
    return _json({ calendars: cals });
  }

  // events
  const start = p.start ? new Date(p.start) : new Date();
  const end   = p.end   ? new Date(p.end)   : new Date(Date.now() + 86400000 * 45);

  var cals;
  if (p.cals){
    cals = p.cals.split(',').map(function (id){ return CalendarApp.getCalendarById(id.trim()); })
                  .filter(function (c){ return c; });
  } else {
    cals = CalendarApp.getAllCalendars();
  }

  const events = [];
  cals.forEach(function (cal){
    const tz = cal.getTimeZone();
    const color = cal.getColor();
    cal.getEvents(start, end).forEach(function (ev){
      const allDay = ev.isAllDayEvent();
      events.push({
        id:       ev.getId(),
        calId:    cal.getId(),
        color:    color,
        title:    ev.getTitle(),
        date:     Utilities.formatDate(ev.getStartTime(), tz, 'yyyy-MM-dd'),
        time:     allDay ? '' : Utilities.formatDate(ev.getStartTime(), tz, 'HH:mm'),
        endDate:  Utilities.formatDate(ev.getEndTime(), tz, 'yyyy-MM-dd'),
        allDay:   allDay,
        location: ev.getLocation() || '',
        notes:    ev.getDescription() || ''
      });
    });
  });

  return _json({ events: events });
}

function _json(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
