// All money is in pesewas (1 GHS = 100 pesewas) so arithmetic stays in integers.
const ghs = (cedis) => cedis * 100;

export const PACKAGES = [
  {
    id: 'intimate',
    name: 'Intimate Gatherings',
    tagline: 'Birthdays, dinners and naming ceremonies',
    description: 'A fully planned small celebration: styling, coordination and a calm host on the day.',
    basePrice: ghs(3500),
    perGuest: ghs(40),
    minGuests: 10,
    maxGuests: 60,
    includes: ['Planning consultation', 'Theme & table styling', 'Vendor coordination', 'Day-of host'],
  },
  {
    id: 'celebration',
    name: 'Weddings & Celebrations',
    tagline: 'Traditional, white and everything between',
    description: 'End-to-end planning for the big days, from engagement to the last dance.',
    basePrice: ghs(15000),
    perGuest: ghs(85),
    minGuests: 50,
    maxGuests: 500,
    includes: ['Full planning timeline', 'Venue & vendor sourcing', 'Décor & florals', 'Day-of coordination team'],
  },
  {
    id: 'corporate',
    name: 'Corporate Events',
    tagline: 'Launches, conferences and end-of-year parties',
    description: 'Polished, on-brand events that run to the minute.',
    basePrice: ghs(10000),
    perGuest: ghs(60),
    minGuests: 20,
    maxGuests: 800,
    includes: ['Run-of-show planning', 'Branding & staging', 'Guest registration', 'AV coordination'],
  },
  {
    id: 'decor',
    name: 'Décor & Styling',
    tagline: 'You plan it, we make it beautiful',
    description: 'Styling only: centrepieces, backdrops, lighting and setup at your venue.',
    basePrice: ghs(4000),
    perGuest: 0,
    minGuests: 1,
    maxGuests: 1000,
    includes: ['Design moodboard', 'Backdrop & centrepieces', 'Lighting', 'Setup & teardown'],
  },
];

export const ADD_ONS = [
  { id: 'photo', name: 'Photography & video', price: ghs(2500) },
  { id: 'mc', name: 'MC / host', price: ghs(1500) },
  { id: 'band', name: 'Live band', price: ghs(6000) },
  { id: 'cake', name: 'Custom cake', price: ghs(1200) },
];

export const findPackage = (id) => PACKAGES.find((p) => p.id === id);
export const findAddOn = (id) => ADD_ONS.find((a) => a.id === id);
