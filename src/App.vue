<script setup lang="ts">
// import HelloWorld from '@components/HelloWorld.vue'
// import { ref, onMounted } from 'vue'
import { useGameListStore } from "@store/global-store";
import LoadingOverlay from "@components/Loading.vue";
import GameList from "@components/GameList.vue";
import AppBar from "@components/AppBar.vue";
import StatusBar from "@components/StatusBar.vue";

const gameListStore = useGameListStore();
</script>

<template>
  <v-app>
    <AppBar />
    <LoadingOverlay />
    <GameList />
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
