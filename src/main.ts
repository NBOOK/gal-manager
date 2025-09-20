import { createApp } from "vue";
import pinia from "@/store/pinia";
import "@/style.css";
import App from "@/App.vue";

import vuetify from "@/vuetify";

const app = createApp(App);

app.use(pinia);
app.use(vuetify);
app.mount("#app");

import { gameEntrySetStore } from "@/modules/GameEntry";
import { imageAssetsSetStore } from "@/modules/ImageAssets";
import { steamDBSetStore } from "@/modules/SteamDB";
import { heroicDBSetStore } from "@/modules/HeroicDB";

gameEntrySetStore();
imageAssetsSetStore();
steamDBSetStore();
heroicDBSetStore();
