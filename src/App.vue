<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useGameStore } from "@/store/global-store";
import LoadingOverlay from "@/components/Loading.vue";
import DBAdderCarousel from "@/components/DBAdderCarousel.vue";
import GameSync from "@/components/GameSync.vue";
import GameList from "@/components/GameList.vue";
import AppBar from "@/components/AppBar.vue";
import StatusBar from "@/components/StatusBar.vue";
import Settings from "@/components/Settings.vue";
import DataSync from "@/components/DataSync.vue";

const gameStore = useGameStore();
const ready = ref(false);

onMounted(async () => {
  gameStore.config.value = await window.ipcRenderer.invoke("fetchJsonConfig");
  // Replace "<STEAM_ID>" in all properties of gameStore.config.value.steam except 'id'
  const steamConfig = gameStore.config.value.steam;
  if (steamConfig && steamConfig.id) {
    Object.keys(steamConfig).forEach((key) => {
      if (key !== "id" && typeof steamConfig[key] === "string") {
        steamConfig[key] = steamConfig[key].replace(
          /<STEAM_ID>/g,
          steamConfig.id
        );
      }
    });
  }

  console.log("Config fetched:", gameStore.config.value);

  if (Object.keys(gameStore.config.value).length === 0) {
    gameStore.settingsOpen = true;
  } else {
    init();
  }
});

async function init() {
  gameStore.netDiskOnline = await window.ipcRenderer.invoke(
    "fileExists",
    `${gameStore.config.value.gamesNetPath}/remote.txt`
  );

  window.ipcRenderer.invoke("kuroshiroOp", "init");
  gameStore.steamDB.setup(gameStore.config.value);
  gameStore.lutrisDB.setup(gameStore.config.value);
  gameStore.heroicDB.setup(gameStore.config.value);

  ready.value = true;
}
</script>

<template>
  <v-app>
    <AppBar v-if="ready" />
    <LoadingOverlay v-if="ready" />
    <DBAdderCarousel v-if="ready" />
    <GameSync v-if="ready" />
    <GameList v-if="ready" />
    <Settings v-if="gameStore.settingsOpen" />
    <DataSync v-if="ready && gameStore.dataSyncManager.managerOpen" />
    <StatusBar v-if="ready" />
  </v-app>
</template>

<style scoped>
button {
  display: block;
  margin: 20px auto;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}
</style>
