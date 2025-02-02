<script setup lang="ts">
// import HelloWorld from '@components/HelloWorld.vue'
import { onMounted, ref } from "vue";
import { useGameStore } from "@/store/global-store";
import LoadingOverlay from "@/components/Loading.vue";
import DBAdderCarousel from "@/views/DBAdderCarousel.vue";
import GameList from "@/components/GameList.vue";
import AppBar from "@/components/AppBar.vue";
import StatusBar from "@/components/StatusBar.vue";
// import FirstTime from "@components/FirstTime.vue";
// import SteamDB from "@modules/SteamDB";

const gameStore = useGameStore();
const firstTime = ref(false);

onMounted(async () => {
  console.log(await window.ipcRenderer.invoke("kuroshiroOp", "init"));
  gameStore.config.value = await window.ipcRenderer.invoke("fetchJsonConfig");
  console.log("Config fetched:", gameStore.config.value);
  if (Object.keys(gameStore.config.value).length === 0) {
    firstTime.value = true;
  } else {
    const externalLinkTarget = await window.ipcRenderer.invoke(
      "readlink",
      gameStore.config.value.gamesExternalPath
    );
    gameStore.netDiskOnline =
      externalLinkTarget === gameStore.config.value.gamesNetPath;

    await gameStore.steamDB.setup(gameStore.config.value);
    await gameStore.lutrisDB.setup(gameStore.config.value);
  }
});
</script>

<template>
  <v-app>
    <AppBar v-if="gameStore.config.value" />
    <LoadingOverlay v-if="gameStore.config.value" />
    <!-- <FirstTime v-if="firstTime" /> -->
    <DBAdderCarousel v-if="gameStore.config.value" />
    <div v-if="firstTime" style="margin-top: 30vh">First Time!</div>
    <GameList v-if="gameStore.config.value" />
    <StatusBar v-if="gameStore.config.value" />
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
