<script setup lang="ts">
// import HelloWorld from '@components/HelloWorld.vue'
import { onMounted } from "vue";
import { useGameStore } from "@/store/global-store";
import LoadingOverlay from "@/components/Loading.vue";
import DBAdderCarousel from "@/views/DBAdderCarousel.vue";
import GameSync from "@/components/GameSync.vue";
import GameList from "@/components/GameList.vue";
import AppBar from "@/components/AppBar.vue";
import StatusBar from "@/components/StatusBar.vue";
import Settings from "@/components/Settings.vue";
import DataSync from "@/components/DataSync.vue";

const gameStore = useGameStore();

onMounted(async () => {
  gameStore.config.value = await window.ipcRenderer.invoke("fetchJsonConfig");
  console.log("Config fetched:", gameStore.config.value);

  if (Object.keys(gameStore.config.value).length === 0) {
    gameStore.settingsOpen = true;
  } else {
    await init();
  }
});

async function init() {
  console.log(await window.ipcRenderer.invoke("kuroshiroOp", "init"));
  const externalLinkTarget = await window.ipcRenderer.invoke(
    "readlink",
    gameStore.config.value.gamesExternalPath
  );
  gameStore.netDiskOnline =
    externalLinkTarget === gameStore.config.value.gamesNetPath;

  await gameStore.steamDB.setup(gameStore.config.value);
  await gameStore.lutrisDB.setup(gameStore.config.value);
}
</script>

<template>
  <v-app>
    <AppBar />
    <LoadingOverlay />
    <DBAdderCarousel />
    <GameSync />
    <GameList />
    <Settings v-if="gameStore.settingsOpen" />
    <DataSync v-if="gameStore.dataSyncManager.managerOpen" />
    <StatusBar />
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
