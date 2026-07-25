/** Croatia geo bounds + major cities for the search experience. */
export const CROATIA_CENTER: [number, number] = [44.5, 16.0];
export const CROATIA_DEFAULT_ZOOM = 7;

export const CROATIAN_CITIES = [
  "Zagreb",
  "Split",
  "Rijeka",
  "Osijek",
  "Zadar",
  "Pula",
  "Slavonski Brod",
  "Karlovac",
  "Varaždin",
  "Šibenik",
  "Sisak",
  "Velika Gorica",
  "Vinkovci",
  "Vukovar",
  "Dubrovnik",
  "Bjelovar",
  "Koprivnica",
  "Požega",
  "Đakovo",
  "Čakovec",
  "Samobor",
  "Trogir",
  "Makarska",
  "Rovinj",
  "Poreč",
  "Opatija",
] as const;

export const CITY_COORDS: Record<string, [number, number]> = {
  Zagreb: [45.815, 15.9819],
  Split: [43.5081, 16.4402],
  Rijeka: [45.3271, 14.4422],
  Osijek: [45.5511, 18.6939],
  Zadar: [44.1194, 15.2314],
  Pula: [44.8666, 13.8496],
  Dubrovnik: [42.6507, 18.0944],
  Šibenik: [43.7350, 15.8952],
  Varaždin: [46.3057, 16.3366],
  Karlovac: [45.4929, 15.5553],
};
