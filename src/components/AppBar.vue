<script setup lang="ts">
import { computed } from "vue";
import { useGameListStore } from "@store/global-store";

const gameListStore = useGameListStore();
// const games = computed(() => gameListStore.games);
const totalGames = computed(() => gameListStore.totalGames);
</script>

<template>
  <v-container>
    <v-app-bar
      :elevation="3"
      rounded="lg"
      scroll-behavior="fully-hide"
      height="36"
    >
      <template v-slot:prepend>
        <!-- <v-icon>mdi-magnify</v-icon> -->
        <v-spacer></v-spacer>
      </template>

      <v-text-field
        id="searchbox-no-border"
        variant="outlined"
        hide-details
        clearable
        clear-icon="mdi-backspace-outline"
        :placeholder="`Search ${totalGames} games (JP/EN)`"
        prepend-inner-icon="mdi-magnify"
        single-line
        max-width="51%"
        rounded="lg"
        v-model="gameListStore.searchQuery"
      ></v-text-field>

      <v-btn icon>
        <v-icon icon="mdi-sort"></v-icon>
        <v-menu
          activator="parent"
          :close-on-content-click="false"
          scroll-strategy="close"
          transition="slide-y-transition"
        >
          <v-sheet rounded="lg">
            <v-btn-toggle mandatory v-model="gameListStore.sort.ascending">
              <v-btn :value="true">
                <v-icon>mdi-sort-ascending</v-icon>
              </v-btn>

              <v-btn :value="false">
                <v-icon>mdi-sort-descending</v-icon>
              </v-btn>
            </v-btn-toggle>

            <v-divider></v-divider>

            <v-btn-toggle
              mandatory
              class="sort-btn-toggle-grid"
              v-model="gameListStore.sort.by"
            >
              <v-btn value="gameName">
                <v-icon>mdi-ideogram-cjk-variant</v-icon>
              </v-btn>

              <v-btn value="gameNameEN">
                <v-icon>mdi-alphabetical-variant</v-icon>
              </v-btn>

              <v-btn value="modifiedTime">
                <v-icon>mdi-calendar-month-outline</v-icon>
              </v-btn>

              <v-btn value="diskUsage">
                <v-icon>mdi-chart-pie-outline</v-icon>
              </v-btn>
            </v-btn-toggle>
          </v-sheet>
        </v-menu>
      </v-btn>
      <v-btn icon="mdi-filter-outline"></v-btn>

      <template v-slot:append>
        <v-btn icon="mdi-heart"></v-btn>

        <v-btn icon="mdi-magnify"></v-btn>

        <v-btn
          icon
          :loading="gameListStore.loading"
          @click="gameListStore.loading = true"
        >
          <v-icon
            :icon="gameListStore.totalGames ? 'mdi-reload' : 'mdi-magnify-scan'"
          />
          <v-tooltip
            activator="parent"
            location="bottom"
            open-delay="500"
            close-on-content-click
          >
            {{ gameListStore.totalGames ? "Rescan games" : "Scan games" }}
          </v-tooltip>
        </v-btn>
      </template>
    </v-app-bar>
  </v-container>
</template>

<style>
.sort-btn-toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  /* 2 列 */
  height: 96px !important;
}

.v-field__field:has(> #searchbox-no-border) ~ .v-field__outline {
  /* border: red solid; */
  visibility: hidden;
}
</style>
