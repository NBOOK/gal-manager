<script setup lang="ts">
// import HelloWorld from '@components/HelloWorld.vue'
// import { ref, onMounted } from 'vue'
import { useGameListStore } from "@store/global-store";
import LoadingOverlay from "@components/Loading.vue";
import GameList from "@components/GameList.vue";

const gameListStore = useGameListStore();
</script>

<template>
  <!-- <div>
    <a href="https://electron-vite.github.io" target="_blank">
      <img src="/electron-vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div> -->
  <!-- <HelloWorld msg="Vite + Vue + Test" /> -->
  <!-- <v-icon icon="mdi-home" color="teal" /> -->
  <button @click="gameListStore.loading = true">Load Games</button>
  <LoadingOverlay />
  <GameList />
</template>

<style scoped>
button {
  display: block;
  margin: 20px auto;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
