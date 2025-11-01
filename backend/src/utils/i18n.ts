
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";

// Initialize i18next
i18next.use(Backend).init({
  fallbackLng: "en",                // default language if none is provided
  preload: ["en", "fr"],            // preload these languages at startup
  backend: {
    // path where translation JSON files are stored
    // loadPath: path.join(__dirname, "../locales/{{lng}}/translation.json"),
    loadPath: path.join(process.cwd(), "src/locales/{{lng}}/translation.json"),
  },
  interpolation: {
    escapeValue: false,             // don't escape HTML entities (safe in backend)
  },
}).then(() => {
    console.log(" i18n initialized");
    console.log("Loaded languages:", i18next.languages);
  })
  .catch((err) => console.error(" i18n init error:", err));
export default i18next;
