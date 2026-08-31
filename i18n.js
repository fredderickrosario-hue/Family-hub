/* ============================================================
   FAMILY HUB — tiny i18n
   Dictionary lookup + {var} interpolation. Language switch
   reloads the page so every module re-renders cleanly.
   Dates/among/weekday names come from Intl (see state.js).
   ============================================================ */
const LANGS = ["en", "fr"];

let lang = (() => {
  try {
    const s = localStorage.getItem("familyhub.lang");
    if (LANGS.includes(s)) return s;
  } catch {}
  return (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
})();

export function getLang(){ return lang; }
export function setLang(l){
  if (!LANGS.includes(l) || l === lang) return;
  try { localStorage.setItem("familyhub.lang", l); } catch {}
  location.reload();
}

const D = {
  en: {
    "nav.calendar": "Calendar", "nav.chores": "Chores", "nav.budget": "Budget",
    "nav.meal": "Meals", "nav.grocery": "Grocery", "nav.family": "Family", "nav.settings": "Settings",
    "nav.update": "Update",

    "common.save": "Save", "common.delete": "Delete", "common.close": "Close",
    "common.clear": "Clear", "common.add": "Add", "common.cancel": "Cancel", "common.edit": "Edit",
    "common.today": "Today", "common.saved": "Saved", "common.error": "Something went wrong",
    "common.date": "Date", "common.time": "Time", "common.notes": "Notes", "common.title": "Title",
    "common.done": "Done", "common.pending": "Pending", "common.all_day": "All day",

    "cal.month": "Month", "cal.week": "Week", "cal.day": "Day", "cal.agenda": "Agenda",
    "cal.more": "{n} more…",
    "cal.empty_day": "Nothing planned for this day. Tap the + button to add something.",
    "cal.empty_short": "Nothing this day.",
    "cal.sync": "Sync", "cal.synced": "Synced",
    "cal.add_event": "Add event", "cal.edit_event": "Edit event", "cal.event_deleted": "Event deleted",
    "cal.gcal_readonly": "From Google Calendar · read-only",

    "fab.event": "Event", "fab.chore": "Chore", "fab.meal": "Meal",
    "fab.budget": "Budget", "fab.grocery": "Grocery",

    "chores.title": "Chores", "chores.add": "Chore",
    "chores.overdue": "Overdue", "chores.due_today": "Due Today",
    "chores.upcoming": "Upcoming", "chores.completed": "Completed",
    "chores.none_today": "Nothing due today — nice.",
    "chores.scoreboard": "Scoreboard", "chores.rewards": "Rewards", "chores.add_reward": "+ Reward",
    "chores.no_rewards": "No rewards yet. Add screen time, dessert, allowance…",
    "chores.need_kids": "Add kid profiles in the Family tab to track points.",
    "chores.done_today": "Done today", "chores.points": "{n} pts",
    "chores.new": "New chore", "chores.edit": "Edit chore",
    "chores.f_title": "Chore", "chores.f_assignee": "Assigned to", "chores.f_due": "Due date",
    "chores.f_kid": "Kid chore (earns points)", "chores.f_points": "Points", "chores.f_repeat": "Repeats",
    "chores.unassigned": "Unassigned",
    "repeat.never": "Never", "repeat.daily": "Daily", "repeat.weekly": "Weekly", "repeat.monthly": "Monthly",
    "reward.new": "New reward", "reward.edit": "Edit reward", "reward.redeem": "Redeem",
    "reward.name": "Reward", "reward.cost": "Cost (points)", "reward.for": "For which kid?",

    "budget.title": "Budget", "budget.add": "Entry",
    "budget.money_in": "Money in", "budget.money_out": "Money out", "budget.net": "Net",
    "budget.mark_done": "Mark done", "budget.no_pending": "No pending entries.",
    "budget.new": "New budget entry", "budget.edit": "Edit entry",
    "budget.f_party": "Who / what", "budget.f_amount": "Amount ($)", "budget.f_dir": "Direction",
    "budget.f_status": "Status", "budget.in": "↓ Money in (payment)", "budget.out": "↑ Money out (payout)",

    "meal.title": "Meals", "meal.to_grocery": "Week → Grocery", "meal.today": "Tonight & Today",
    "meal.none_today": "No meals planned for today yet.", "meal.add_ingr": "Add ingredients",
    "meal.plan": "Plan meal", "meal.edit": "Edit meal",
    "meal.breakfast": "Breakfast", "meal.lunch": "Lunch", "meal.dinner": "Dinner", "meal.snack": "Snack",
    "meal.f_type": "Meal", "meal.f_desc": "What's cooking?", "meal.f_ingr": "Ingredients",

    "grocery.title": "Grocery", "grocery.to_get": "{n} to get", "grocery.add_ph": "Add an item…",
    "grocery.empty": "Nothing on the list. Add items above.",
    "cat.Produce": "Produce", "cat.Dairy": "Dairy", "cat.Meat": "Meat", "cat.Bakery": "Bakery",
    "cat.Frozen": "Frozen", "cat.Pantry": "Pantry", "cat.Drinks": "Drinks",
    "cat.Household": "Household", "cat.Other": "Other",

    "family.title": "Family", "family.add": "Person",
    "family.blurb": "Colors show up on every chore, event and scoreboard.",
    "family.empty": "No family members yet. Add everyone who uses the hub — give each a color.",
    "family.kid": "Kid", "family.adult": "Adult", "family.pts": "{n} pts",
    "family.new": "Add person", "family.edit": "Edit person",
    "family.f_name": "Name", "family.f_color": "Color",
    "family.f_avatar": "Avatar (emoji or leave blank for initials)",
    "family.f_kid": "This is a kid (earns chore points)", "family.f_points": "Points balance",

    "wx.title": "Weather", "wx.city": "City", "wx.units": "Units",
    "wx.celsius": "Celsius °C", "wx.fahrenheit": "Fahrenheit °F",
    "wx.search": "Search & save", "wx.not_found": "City not found — try another spelling",
    "wx.set": "Weather set to {city}", "wx.cleared": "Weather cleared",

    "rel.today": "Today", "rel.tomorrow": "Tomorrow", "rel.yesterday": "Yesterday",
    "rel.in_days": "In {n} days", "rel.days_ago": "{n} days ago",

    "set.title": "Settings",
    "set.appearance": "Appearance", "set.theme": "Theme", "set.language": "Language",
    "set.theme_light": "Light", "set.theme_dark": "Dark", "set.theme_system": "System",
    "set.calendar": "Calendar", "set.default_view": "Default view", "set.week_start": "Week starts on",
    "set.sunday": "Sunday", "set.monday": "Monday",
    "set.synced_cals": "Synced calendars", "set.synced_sub": "Sorted by number of events this month.",
    "set.sync_new": "Sync New Calendar", "set.connect_gcal": "Connect Google Calendar",
    "ics.title": "Import a phone calendar", "ics.import": "Import", "ics.url": "Calendar URL (iCal / .ics)",
    "ics.name": "Label (optional)", "ics.events": "events imported", "ics.none": "No events found in that calendar",
    "ics.imported": "Imported {n} events from {name}",
    "ics.help": "Paste the secret iCal address of your calendar. Google Calendar → Settings → your calendar → “Secret address in iCal format”. Apple iCloud → share a calendar → Public Calendar link. Outlook/Hotmail → Calendar → Share → Publish → ICS link. Samsung phones sync to a Google or Microsoft account — use that account’s address.",
    "ics.blocked": "That calendar blocks cross-site access. Connect the Google relay under Synced calendars — it can fetch the URL for you.",
    "set.import_phone": "Import phone calendar",
    "set.not_connected": "Google Calendar isn't connected yet.",
    "set.reconfigure": "Relay settings", "set.calendars_on": "Calendars from your Google account",
    "set.data": "Data & app", "set.check_updates": "Check for updates", "set.update_now": "Update now — new version ready",
    "set.up_to_date": "You're on the latest version", "set.updating": "Updating…",
    "set.reset_weather": "Reset weather location",
    "set.about": "About", "set.version": "Version"
  },

  fr: {
    "nav.calendar": "Agenda", "nav.chores": "Tâches", "nav.budget": "Budget",
    "nav.meal": "Repas", "nav.grocery": "Épicerie", "nav.family": "Famille", "nav.settings": "Réglages",
    "nav.update": "Mise à jour",

    "common.save": "Enregistrer", "common.delete": "Supprimer", "common.close": "Fermer",
    "common.clear": "Effacer", "common.add": "Ajouter", "common.cancel": "Annuler", "common.edit": "Modifier",
    "common.today": "Aujourd’hui", "common.saved": "Enregistré", "common.error": "Une erreur est survenue",
    "common.date": "Date", "common.time": "Heure", "common.notes": "Notes", "common.title": "Titre",
    "common.done": "Fait", "common.pending": "En attente", "common.all_day": "Toute la journée",

    "cal.month": "Mois", "cal.week": "Semaine", "cal.day": "Jour", "cal.agenda": "Agenda",
    "cal.more": "{n} de plus…",
    "cal.empty_day": "Rien de prévu ce jour. Touchez le bouton + pour ajouter quelque chose.",
    "cal.empty_short": "Rien ce jour.",
    "cal.sync": "Sync", "cal.synced": "Synchro",
    "cal.add_event": "Ajouter un événement", "cal.edit_event": "Modifier l’événement",
    "cal.event_deleted": "Événement supprimé",
    "cal.gcal_readonly": "Depuis Google Agenda · lecture seule",

    "fab.event": "Événement", "fab.chore": "Tâche", "fab.meal": "Repas",
    "fab.budget": "Budget", "fab.grocery": "Épicerie",

    "chores.title": "Tâches", "chores.add": "Tâche",
    "chores.overdue": "En retard", "chores.due_today": "Pour aujourd’hui",
    "chores.upcoming": "À venir", "chores.completed": "Terminées",
    "chores.none_today": "Rien pour aujourd’hui — parfait.",
    "chores.scoreboard": "Tableau des points", "chores.rewards": "Récompenses", "chores.add_reward": "+ Récompense",
    "chores.no_rewards": "Aucune récompense. Ajoutez du temps d’écran, un dessert, de l’argent de poche…",
    "chores.need_kids": "Ajoutez des profils d’enfants dans l’onglet Famille pour suivre les points.",
    "chores.done_today": "Fait aujourd’hui", "chores.points": "{n} pts",
    "chores.new": "Nouvelle tâche", "chores.edit": "Modifier la tâche",
    "chores.f_title": "Tâche", "chores.f_assignee": "Assignée à", "chores.f_due": "Échéance",
    "chores.f_kid": "Tâche d’enfant (donne des points)", "chores.f_points": "Points", "chores.f_repeat": "Répétition",
    "chores.unassigned": "Non assignée",
    "repeat.never": "Jamais", "repeat.daily": "Chaque jour", "repeat.weekly": "Chaque semaine", "repeat.monthly": "Chaque mois",
    "reward.new": "Nouvelle récompense", "reward.edit": "Modifier la récompense", "reward.redeem": "Échanger",
    "reward.name": "Récompense", "reward.cost": "Coût (points)", "reward.for": "Pour quel enfant ?",

    "budget.title": "Budget", "budget.add": "Entrée",
    "budget.money_in": "Entrées", "budget.money_out": "Sorties", "budget.net": "Solde",
    "budget.mark_done": "Marquer fait", "budget.no_pending": "Aucune entrée en attente.",
    "budget.new": "Nouvelle entrée", "budget.edit": "Modifier l’entrée",
    "budget.f_party": "Qui / quoi", "budget.f_amount": "Montant ($)", "budget.f_dir": "Sens",
    "budget.f_status": "Statut", "budget.in": "↓ Entrée d’argent", "budget.out": "↑ Sortie d’argent",

    "meal.title": "Repas", "meal.to_grocery": "Semaine → Épicerie", "meal.today": "Ce soir & aujourd’hui",
    "meal.none_today": "Aucun repas prévu pour aujourd’hui.", "meal.add_ingr": "Ajouter les ingrédients",
    "meal.plan": "Planifier un repas", "meal.edit": "Modifier le repas",
    "meal.breakfast": "Déjeuner", "meal.lunch": "Dîner", "meal.dinner": "Souper", "meal.snack": "Collation",
    "meal.f_type": "Repas", "meal.f_desc": "On mange quoi ?", "meal.f_ingr": "Ingrédients",

    "grocery.title": "Épicerie", "grocery.to_get": "{n} à acheter", "grocery.add_ph": "Ajouter un article…",
    "grocery.empty": "Liste vide. Ajoutez des articles ci-dessus.",
    "cat.Produce": "Fruits & légumes", "cat.Dairy": "Produits laitiers", "cat.Meat": "Viande",
    "cat.Bakery": "Boulangerie", "cat.Frozen": "Surgelés", "cat.Pantry": "Garde-manger",
    "cat.Drinks": "Boissons", "cat.Household": "Maison", "cat.Other": "Autre",

    "family.title": "Famille", "family.add": "Personne",
    "family.blurb": "Les couleurs apparaissent sur chaque tâche, événement et au tableau des points.",
    "family.empty": "Aucun membre. Ajoutez tout le monde qui utilise le hub — une couleur chacun.",
    "family.kid": "Enfant", "family.adult": "Adulte", "family.pts": "{n} pts",
    "family.new": "Ajouter une personne", "family.edit": "Modifier la personne",
    "family.f_name": "Nom", "family.f_color": "Couleur",
    "family.f_avatar": "Avatar (emoji, ou vide pour les initiales)",
    "family.f_kid": "C’est un enfant (gagne des points)", "family.f_points": "Solde de points",

    "wx.title": "Météo", "wx.city": "Ville", "wx.units": "Unités",
    "wx.celsius": "Celsius °C", "wx.fahrenheit": "Fahrenheit °F",
    "wx.search": "Chercher & enregistrer", "wx.not_found": "Ville introuvable — essayez une autre orthographe",
    "wx.set": "Météo réglée sur {city}", "wx.cleared": "Météo effacée",

    "rel.today": "Aujourd’hui", "rel.tomorrow": "Demain", "rel.yesterday": "Hier",
    "rel.in_days": "Dans {n} jours", "rel.days_ago": "Il y a {n} jours",

    "set.title": "Réglages",
    "set.appearance": "Apparence", "set.theme": "Thème", "set.language": "Langue",
    "set.theme_light": "Clair", "set.theme_dark": "Sombre", "set.theme_system": "Système",
    "set.calendar": "Agenda", "set.default_view": "Vue par défaut", "set.week_start": "La semaine commence le",
    "set.sunday": "Dimanche", "set.monday": "Lundi",
    "set.synced_cals": "Agendas synchronisés", "set.synced_sub": "Triés par nombre d’événements ce mois-ci.",
    "set.sync_new": "Synchroniser un agenda", "set.connect_gcal": "Connecter Google Agenda",
    "ics.title": "Importer un agenda du téléphone", "ics.import": "Importer", "ics.url": "URL de l’agenda (iCal / .ics)",
    "ics.name": "Étiquette (facultatif)", "ics.events": "événements importés", "ics.none": "Aucun événement trouvé dans cet agenda",
    "ics.imported": "{n} événements importés depuis {name}",
    "ics.help": "Collez l’adresse iCal secrète de votre agenda. Google Agenda → Paramètres → votre agenda → « Adresse secrète au format iCal ». Apple iCloud → partager un agenda → lien Agenda public. Outlook/Hotmail → Calendrier → Partager → Publier → lien ICS. Les téléphones Samsung se synchronisent à un compte Google ou Microsoft — utilisez l’adresse de ce compte.",
    "ics.blocked": "Cet agenda bloque l’accès inter-sites. Connectez le relais Google dans Agendas synchronisés — il peut récupérer l’URL pour vous.",
    "set.import_phone": "Importer l’agenda du téléphone",
    "set.not_connected": "Google Agenda n’est pas encore connecté.",
    "set.reconfigure": "Réglages du relais", "set.calendars_on": "Agendas de votre compte Google",
    "set.data": "Données & app", "set.check_updates": "Vérifier les mises à jour", "set.update_now": "Mettre à jour — nouvelle version prête",
    "set.up_to_date": "Vous avez la dernière version", "set.updating": "Mise à jour…",
    "set.reset_weather": "Réinitialiser la localisation météo",
    "set.about": "À propos", "set.version": "Version"
  }
};

export function t(key, vars){
  let s = (D[lang] && D[lang][key]);
  if (s == null) s = D.en[key];
  if (s == null) return key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}
