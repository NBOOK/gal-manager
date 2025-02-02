// Vuetify
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { aliases, mdi } from "vuetify/iconsets/mdi";

// import wineEmpty from "./icons/customWineEmpty.vue";
// import wineFill from "./icons/customWineFill.vue";

// const aliasesCustom = {
//   ...aliases,
//   ["wine-empty"]: wineEmpty,
//   ["wine-fill"]: wineFill,
// };

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: "mdi",
    aliases,
    // aliasesCustom,
    sets: {
      mdi,
    },
  },
});

export default vuetify;
