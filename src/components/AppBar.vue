<script setup lang="ts">
  import { useGameStore } from "@/store/global-store";
  import Download from "@/components/Download.vue";
  import GameFilter from "@/components/GameFilter.vue";

  const gameStore = useGameStore();
  const sortConfig = gameStore.sort;

  function checkAllFilteredGames() {
    gameStore.filterSortedGames.forEach((game) => (game.selected = true));
  }

  function uncheckAllFilteredGames() {
    gameStore.filterSortedGames.forEach((game) => (game.selected = false));
  }

  function pushAllToDownloadList(target: string) {
    gameStore.downloadList.push(
      ...gameStore.selectedGames
        .map((game) => ({
          game: game,
          source: game.linked ? game.linkedBasePath : game.basePath,
          target: target,
          progress: 0,
        }))
        .filter((item) => {
          // 检查 game.gameName 是否已经在 downloadList 中存在
          const isDuplicate = gameStore.downloadList.some(
            (existingItem) => existingItem.game.gameName === item.game.gameName
          );
          // 如果不存在重复项，则保留该项
          return !isDuplicate;
        })
    );
  }

  async function deleteAllSelectedGames() {
    gameStore.selectedGames.forEach(async (game) => await game.deleteLocal());
  }
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
          :loading="gameStore.loading"
          @click="gameStore.loading = true"
        >
          <v-icon
            :icon="gameStore.totalGames ? 'mdi-reload' : 'mdi-magnify-scan'"
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
        clear-icon="mdi-backspace-outline"
        :placeholder="`Search ${gameStore.totalGames} games (JP/EN)`"
        prepend-inner-icon="mdi-magnify"
        single-line
        max-width="51%"
        rounded="lg"
        :spellcheck="false"
        v-model="gameStore.searchQuery"
        @keydown.esc="gameStore.searchQuery = ''"
      ></v-text-field>

      <!-- Sort -->
      <v-btn icon>
        <v-icon icon="mdi-sort"></v-icon>
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
                <v-icon size="x-large">mdi-sort-ascending</v-icon>
              </v-btn>

              <v-btn :value="false">
                <v-icon size="x-large">mdi-sort-descending</v-icon>
              </v-btn>
            </v-btn-toggle>

            <v-divider></v-divider>

            <v-btn-toggle mandatory class="grid2x2" v-model="sortConfig.by">
              <v-btn value="gameName">
                <v-icon size="x-large">mdi-alphabetical-variant</v-icon>
              </v-btn>

              <v-btn value="gameBrand">
                <v-icon size="x-large">mdi-domain</v-icon>
              </v-btn>

              <v-btn value="modifiedTime">
                <v-icon size="x-large">mdi-calendar-month-outline</v-icon>
              </v-btn>

              <v-btn value="diskUsage">
                <v-icon size="x-large">mdi-chart-pie-outline</v-icon>
              </v-btn>
            </v-btn-toggle>
          </v-sheet>
        </v-menu>
      </v-btn>

      <!-- Filter -->
      <GameFilter />

      <template v-slot:append>
        <v-spacer></v-spacer>
        <Download v-if="gameStore.config.value" />
        <!-- Dot menu -->
        <v-btn icon>
          <v-icon icon="mdi-dots-vertical" />
          <v-menu
            activator="parent"
            :close-on-content-click="false"
            scroll-strategy="close"
            transition="slide-y-transition"
            location="bottom center"
            origin="top center"
          >
            <v-sheet rounded="lg">
              <v-btn-group>
                <v-btn @click="checkAllFilteredGames">
                  <v-icon size="x-large">mdi-checkbox-multiple-marked</v-icon>
                </v-btn>

                <v-btn @click="uncheckAllFilteredGames">
                  <v-icon size="x-large"
                    >mdi-checkbox-multiple-blank-outline</v-icon
                  >
                </v-btn>
              </v-btn-group>

              <v-divider></v-divider>

              <v-btn-group class="grid2x2">
                <v-btn
                  :readonly="
                    gameStore.selectedGames.length === 0 ||
                    gameStore.selectedGames.some(
                      (game) => game.inDeck || game.inSDCard || game.inUSB
                    )
                  "
                >
                  <v-icon
                    :color="
                      gameStore.selectedGames.length === 0 ||
                      gameStore.selectedGames.some(
                        (game) => game.inDeck || game.inSDCard || game.inUSB
                      )
                        ? 'grey'
                        : 'grey-darken-4'
                    "
                    size="x-large"
                    >mdi-cloud-download</v-icon
                  >
                  <v-menu
                    activator="parent"
                    scroll-strategy="close"
                    transition="slide-x-reverse-transition"
                    location="start center"
                    origin="end center"
                  >
                    <v-sheet rounded="lg">
                      <v-btn-group>
                        <v-btn
                          @click="
                            pushAllToDownloadList(
                              gameStore.config.value.gamesDataPath
                            )
                          "
                        >
                          <v-icon size="x-large">mdi-gamepad-square</v-icon>
                        </v-btn>

                        <v-btn
                          @click="
                            pushAllToDownloadList(
                              gameStore.config.value.gamesSDPath
                            )
                          "
                        >
                          <v-icon size="x-large">mdi-micro-sd</v-icon>
                        </v-btn>

                        <v-btn
                          @click="
                            pushAllToDownloadList(
                              gameStore.config.value.gamesUSBPath
                            )
                          "
                        >
                          <v-icon size="x-large">mdi-usb</v-icon>
                        </v-btn>
                      </v-btn-group>
                    </v-sheet>
                  </v-menu>
                </v-btn>
                <v-btn
                  :readonly="
                    gameStore.selectedGames.length === 0 ||
                    gameStore.selectedGames.some((game) => !game.linked)
                  "
                  @click="gameStore.dbEditList.push(...gameStore.selectedGames)"
                >
                  <v-icon
                    :color="
                      gameStore.selectedGames.length === 0 ||
                      gameStore.selectedGames.some((game) => !game.linked)
                        ? 'grey'
                        : 'grey-darken-4'
                    "
                    size="x-large"
                    >mdi-database-edit</v-icon
                  >
                </v-btn>

                <v-btn
                  :readonly="
                    gameStore.selectedGames.length === 0 ||
                    !gameStore.selectedGames.every(
                      (game) => game.inDeck || game.inSDCard || game.inUSB
                    )
                  "
                >
                  <v-icon
                    :color="
                      gameStore.selectedGames.length === 0 ||
                      !gameStore.selectedGames.every(
                        (game) => game.inDeck || game.inSDCard || game.inUSB
                      )
                        ? 'grey'
                        : 'grey-darken-4'
                    "
                    size="x-large"
                    >mdi-delete</v-icon
                  >
                  <v-dialog activator="parent" max-width="522">
                    <template v-slot:default="{ isActive }">
                      <v-card
                        prepend-icon="mdi-delete-empty"
                        title="Free Local Storage"
                      >
                        <v-container
                          max-height="200px"
                          class="text-center game-list-container py-0"
                        >
                          <v-card-subtitle
                            v-for="game in gameStore.selectedGames"
                            >{{ game.gameName }}</v-card-subtitle
                          >
                        </v-container>
                        <v-card-text>
                          You're removing the games listed above from local
                          storage. This action is irreversible without a NetDisk
                          backup.
                        </v-card-text>
                        <template v-slot:actions>
                          <v-spacer></v-spacer>
                          <v-btn
                            class="ml-auto"
                            text="yes"
                            color="red"
                            @click="
                              async () => {
                                await deleteAllSelectedGames();
                                isActive.value = false;
                              }
                            "
                          ></v-btn>
                          <v-btn
                            class="ml-auto"
                            text="no"
                            @click="isActive.value = false"
                          ></v-btn>
                        </template>
                      </v-card>
                    </template>
                  </v-dialog>
                </v-btn>

                <v-btn :readonly="gameStore.selectedGames.length === 0">
                  <v-icon
                    :color="
                      gameStore.selectedGames.length === 0
                        ? 'grey'
                        : 'grey-darken-4'
                    "
                    size="x-large"
                    >mdi-chart-pie-outline</v-icon
                  >
                </v-btn>
              </v-btn-group>
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

  .cover-mask {
    position: absolute;
    background: #fff;
    /* pointer-events: none; */
    height: 100%;
    top: 0;
    right: 0;
    width: 10px;
    transition: all 0.5s;
    opacity: 1;
  }

  .cover-mask.hidden {
    pointer-events: none;
    opacity: 0;
  }
</style>
