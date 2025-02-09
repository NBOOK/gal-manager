<script setup lang="ts">
import { useGameStore } from "@/store/global-store";
import Download from "@/components/Download.vue";
import GameFilter from "@/components/GameFilter.vue";
import BatchMenu from "@/components/BatchMenu.vue";

const gameStore = useGameStore();
const sortConfig = gameStore.sort;
</script>

<template>
  <v-container>
    <v-app-bar
      :elevation="3"
      rounded="lg"
      scroll-behavior="fully-hide"
      density="compact"
    >
      <template v-slot:prepend>
        <v-btn
          icon
          :readonly="!gameStore.fileOperatable"
          :loading="gameStore.loading"
          @click="gameStore.loading = true"
        >
          <v-icon
            :icon="gameStore.totalGames ? '$mdiReload' : '$mdiMagnifyScan'"
          />
          <v-tooltip
            activator="parent"
            location="bottom"
            open-delay="500"
            close-on-content-click
          >
            {{ gameStore.totalGames ? "Rescan games" : "Scan games" }}
          </v-tooltip>
        </v-btn>
        <v-spacer></v-spacer>
      </template>

      <!-- Search box -->
      <v-text-field
        id="searchbox-no-border"
        variant="outlined"
        hide-details
        clearable
        clear-icon="$mdiBackspaceOutline"
        :placeholder="`Search ${gameStore.totalGames} games (JP/EN)`"
        prepend-inner-icon="$mdiMagnify"
        single-line
        max-width="51%"
        rounded="lg"
        :spellcheck="false"
        v-model="gameStore.searchQuery"
        @keydown.esc="gameStore.searchQuery = ''"
      ></v-text-field>

      <!-- Sort -->
      <v-btn
        icon
        @contextmenu.prevent="sortConfig.ascending = !sortConfig.ascending"
      >
        <v-icon
          :icon="
            sortConfig.ascending ? '$mdiSortAscending' : '$mdiSortDescending'
          "
        ></v-icon>
        <v-menu
          activator="parent"
          :close-on-content-click="false"
          scroll-strategy="close"
          transition="slide-y-transition"
          location="bottom center"
          origin="top center"
        >
          <v-sheet rounded="lg">
            <v-btn-toggle mandatory v-model="sortConfig.ascending">
              <v-btn :value="true">
                <v-icon size="x-large">$mdiSortAscending</v-icon>
              </v-btn>

              <v-btn :value="false">
                <v-icon size="x-large">$mdiSortDescending</v-icon>
              </v-btn>
            </v-btn-toggle>

            <v-divider></v-divider>

            <v-btn-toggle mandatory class="grid2x2" v-model="sortConfig.by">
              <v-btn value="gameName">
                <v-icon size="x-large">$mdiAlphabeticalVariant</v-icon>
              </v-btn>

              <v-btn value="gameBrand">
                <v-icon size="x-large">$mdiDomain</v-icon>
              </v-btn>

              <v-btn value="modifiedTime">
                <v-icon size="x-large">$mdiCalendarMonthOutline</v-icon>
              </v-btn>

              <v-btn value="diskUsage">
                <v-icon size="x-large">$mdiChartPieOutline</v-icon>
              </v-btn>
            </v-btn-toggle>
          </v-sheet>
        </v-menu>
      </v-btn>

      <!-- Filter -->
      <GameFilter />

      <template v-slot:append>
        <v-spacer></v-spacer>
        <!-- Placeholder -->
        <div
          v-if="gameStore.fileOperatable"
          class="invisible"
          style="width: 32px"
        ></div>

        <!-- Download btn & panel -->
        <Download v-if="gameStore.downloadList.length > 0" />

        <!-- Sync btn -->
        <v-progress-circular
          v-if="gameStore.syncManager.syncList.length > 0"
          width="3"
          :model-value="gameStore.syncManager.progress"
          :class="{ rotating: gameStore.syncManager.progress > 0 }"
        >
          <v-btn icon @click="gameStore.syncManager.managerOpen = true">
            <v-icon size="small" icon="$mdiAutorenew" />
          </v-btn>
        </v-progress-circular>

        <!-- Dot menu -->
        <BatchMenu />
        <v-btn icon>
          <v-icon>$mdiDotsVertical</v-icon>
          <v-menu
            activator="parent"
            scroll-strategy="close"
            transition="slide-y-transition"
            location="bottom center"
            origin="top center"
          >
            <v-sheet rounded="lg">
              <v-list slim density="compact">
                <v-list-item
                  prepend-icon="$mdiCog"
                  value="settings"
                  title="Settings"
                  @click="gameStore.settingsOpen = true"
                />
                <v-list-item
                  prepend-icon="$mdiFileSync"
                  value="fileSync"
                  title="Savedata Sync"
                  @click="gameStore.dataSyncManager.managerOpen = true"
                  :readonly="!gameStore.fileOperatable"
                />
              </v-list>
            </v-sheet>
          </v-menu>
        </v-btn>
      </template>
    </v-app-bar>
  </v-container>
</template>

<style>
.grid2x2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  /* 2 列 */
  height: 96px !important;
}

.v-field__field:has(> #searchbox-no-border) ~ .v-field__outline {
  /* border: red solid; */
  visibility: hidden;
}

.invisible {
  visibility: hidden;
}

.rotating {
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.game-list-container {
  /* position: relative; */
  overflow-y: scroll !important;
  /* padding-right: calc(1em - 10px); */
}

.game-list-container::-webkit-scrollbar {
  /* width: 10px;
  height: 10px; */
  display: none;
}

.game-list-container::-webkit-scrollbar-track {
  background: #f0f0f0;
}

.game-list-container::-webkit-scrollbar-track:hover {
  background: #f0f0f0;
}

.game-list-container::-webkit-scrollbar-thumb {
  background-color: #cccccc;
  border-radius: 10px;
}

.game-list-container::-webkit-scrollbar-thumb:hover {
  background-color: #888888;
}
</style>
