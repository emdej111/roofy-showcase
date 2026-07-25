import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import hr from "./locales/hr.json";
import en from "./locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      hr: { translation: hr },
      en: { translation: en },
    },
    fallbackLng: "hr",
    supportedLngs: ["hr", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "najamhr_lang",
    },
  });

export default i18n;
