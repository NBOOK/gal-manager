<script setup lang="ts">
// import HelloWorld from '@components/HelloWorld.vue'
import { onMounted, ref } from "vue";
import { useGameStore } from "@store/global-store";
import LoadingOverlay from "@components/Loading.vue";
import GameList from "@components/GameList.vue";
import AppBar from "@components/AppBar.vue";
import StatusBar from "@components/StatusBar.vue";
import FirstTime from "@components/FirstTime.vue";

const gameStore = useGameStore();
const firstTime = ref(false);

onMounted(async () => {
  gameStore.config.value = await window.ipcRenderer.invoke("fetchConfig");
  console.log(gameStore.config.value);
  if (Object.keys(gameStore.config.value).length === 0) {
    console.log("First time!");
    firstTime.value = true;
  }
});
</script>

<template>
  <v-app>
    <AppBar v-if="!firstTime" />
    <LoadingOverlay v-if="!firstTime" />
    <!-- <FirstTime v-if="firstTime" /> -->
    <div v-if="firstTime" style="margin-top: 30vh">First Time!</div>
    <GameList v-if="!firstTime" />
    <StatusBar v-if="!firstTime" />
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
