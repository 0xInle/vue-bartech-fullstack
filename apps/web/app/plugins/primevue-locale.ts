import { usePrimeVue } from "primevue/config";
import { primeVueRussianLocale } from "../../primevue-locale";

export default defineNuxtPlugin({
  name: "primevue-russian-locale",
  enforce: "post",
  setup() {
    const primeVue = usePrimeVue();
    primeVue.config.locale = { ...primeVue.config.locale, ...primeVueRussianLocale };
  },
});
