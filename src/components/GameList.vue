<script setup lang="ts">
import { computed } from "vue";
import { useGameListStore } from "@store/global-store";
import GameItem from "@components/GameItem.vue";
import GameEntry from "@modules/GameEntry";

const gameListStore = useGameListStore();
const games = computed(() => {
  let filteredGames = gameListStore.games;
  if (gameListStore.searchQuery) {
    const searchQuery = gameListStore.searchQuery.toLowerCase();
    filteredGames = Object.fromEntries(
      Object.entries(gameListStore.games).filter(
        ([_, game]: [string, GameEntry]) => {
          return (
            game.gameName.toLowerCase().includes(searchQuery) ||
            game.gameNameEN.toLowerCase().includes(searchQuery)
          );
        }
      )
    );
  }
  return filteredGames;
});
const totalGames = computed(() => gameListStore.totalGames);
</script>

<template>
  <!-- <div class="game-list-container"> -->
  <!-- <div style="overflow-y: scroll"> -->
  <!-- <div class="game-list" v-if="totalGames > 0"> -->
  <!-- <v-container v-if="totalGames > 0"> -->
  <GameItem v-for="(game, key) in games" :key="key" :game="game"> </GameItem>
  <!-- </v-container> -->
  <!-- </div> -->
  <!-- <div v-else>No games available.</div> -->
  <!-- </div> -->
  <!-- </div> -->
</template>

<style scoped>
.game-list-container {
  width: 100%;
  overflow-y: scroll;
  border: 1px solid #ccc;
  padding: 10px;
  border-radius: 5px;
  box-sizing: border-box;
}

.game-list {
  display: flex;
  flex-direction: column;
}
</style>
