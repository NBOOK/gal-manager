<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useGameListStore } from "@store/global-store";
import GameItem from "@components/GameItem.vue";
// import GameEntry from "@modules/GameEntry";

const gameListStore = useGameListStore();

const contentHeight = ref(window.innerHeight - 36 - 20);

const updateContentHeight = () => {
  contentHeight.value = window.innerHeight - 36 - 20;
};

onMounted(() => {
  window.addEventListener("resize", updateContentHeight);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateContentHeight);
});

const games = computed(() => {
  let filteredGames = Object.values(gameListStore.games); // 转换为数组一次即可
  if (gameListStore.searchQuery) {
    const searchQuery = gameListStore.searchQuery.toLowerCase();
    filteredGames = filteredGames.filter(
      (game) =>
        game.gameName.toLowerCase().includes(searchQuery) ||
        game.gameNameEN.toLowerCase().includes(searchQuery)
    );
  }
  if (gameListStore.sort.by) {
    const sortBy = gameListStore.sort.by;
    const ascending = gameListStore.sort.ascending;
    filteredGames = filteredGames.sort((gameA, gameB) => {
      if (gameA[sortBy] < gameB[sortBy]) return ascending ? -1 : 1;
      if (gameA[sortBy] > gameB[sortBy]) return ascending ? 1 : -1;
      return 0;
    });
  }
  return filteredGames;
});
// const totalGames = computed(() => gameListStore.totalGames);
</script>

<template>
  <v-virtual-scroll
    v-if="!gameListStore.loading"
    :height="contentHeight"
    :items="games"
    item-height="100"
    style="padding-top: 6px"
  >
    <template v-slot:default="{ item, index }">
      <GameItem :game="item" :index="index" :key="item.gameName" />
    </template>
  </v-virtual-scroll>
</template>

<style scoped>
.v-virtual-scroll::-webkit-scrollbar {
  width: 8px;
}

.v-virtual-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.v-virtual-scroll::-webkit-scrollbar-thumb {
  background-color: #888;
  border-radius: 10px;
}

.v-virtual-scroll::-webkit-scrollbar-thumb:hover {
  background-color: #555;
}
</style>
