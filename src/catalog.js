// All money is in pesewas (1 GHS = 100 pesewas) so arithmetic stays in integers.
const ghs = (cedis) => cedis * 100;

// Every package includes the full décor set; packages differ by guest count.
export const INCLUDED = [
  'Stunning themed backdrops',
  'Elegant couple chairs',
  'Premium guest seating',
  'Exquisite centrepieces',
  'Luxury napkins & table linens',
  'Artistic floral & hanging décor',
  'Charger plates & wine glasses',
  'Plush table carpets',
  'Dedicated gift tables',
  'A sparkling dance floor',
];

// PRICES ARE PLACEHOLDERS: confirm the real figures with Dovey Events before going live.
export const PACKAGES = [
  {
    id: 'guests-50',
    name: '50 Guests',
    tagline: 'Intimate and beautifully dressed',
    description: 'The full Dovey Events décor experience, styled for a close circle of up to 50 guests.',
    basePrice: ghs(8000),
    perGuest: 0,
    minGuests: 1,
    maxGuests: 50,
  },
  {
    id: 'guests-100',
    name: '100 Guests',
    tagline: 'Room for family and friends',
    description: 'Our most-booked setup: every element styled for up to 100 guests.',
    basePrice: ghs(14000),
    perGuest: 0,
    minGuests: 1,
    maxGuests: 100,
  },
  {
    id: 'guests-150',
    name: '150 Guests',
    tagline: 'A celebration in full bloom',
    description: 'A generous, statement setup for up to 150 guests.',
    basePrice: ghs(19000),
    perGuest: 0,
    minGuests: 1,
    maxGuests: 150,
  },
  {
    id: 'guests-200',
    name: '200 Guests',
    tagline: 'The grand occasion',
    description: 'Our largest package, dressing the whole room for up to 200 guests.',
    basePrice: ghs(24000),
    perGuest: 0,
    minGuests: 1,
    maxGuests: 200,
  },
];

export const OCCASIONS = [
  { id: 'wedding', name: 'Wedding' },
  { id: 'bridal', name: 'Bridal party' },
  { id: 'birthday', name: 'Birthday' },
  { id: 'christening', name: 'Baby christening' },
  { id: 'funeral', name: 'Funeral' },
  { id: 'other', name: 'Something else' },
];

// Optional extras, priced on top of a package. Empty for now: add entries here
// (e.g. { id: 'cake', name: 'Custom cake', price: ghs(1200) }) and they appear on the booking form.
export const ADD_ONS = [];

export const findPackage = (id) => PACKAGES.find((p) => p.id === id);
export const findAddOn = (id) => ADD_ONS.find((a) => a.id === id);
export const findOccasion = (id) => OCCASIONS.find((o) => o.id === id);
