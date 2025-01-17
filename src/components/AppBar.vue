<script setup lang="ts">
import { computed } from "vue";
import { useGameListStore } from "@store/global-store";

const gameListStore = useGameListStore();
const games = computed(() => gameListStore.games);
const totalGames = computed(() => gameListStore.totalGames);
</script>

<template>
  <v-container>
    <v-app-bar :elevation="3" rounded="lg" density="compact">
      <!-- <template v-slot:prepend>
        <v-icon>mdi-magnify</v-icon>
      </template> -->

      <!-- <v-app-bar-title>Application Bar</v-app-bar-title> -->
      <v-text-field
        hide-details
        clearable
        clear-icon="mdi-backspace-outline"
        color="success"
        placeholder="Search games (JP/EN)"
        prepend-inner-icon="mdi-magnify"
        single-line
        max-width="50%"
        rounded="lg"
        v-model="gameListStore.searchQuery"
      ></v-text-field>
      <template v-slot:append>
        <v-btn icon="mdi-heart"></v-btn>

        <v-btn icon="mdi-magnify"></v-btn>

        <v-btn icon="mdi-dots-vertical"></v-btn>
      </template>
    </v-app-bar>
  </v-container>
</template>
