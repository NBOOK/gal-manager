<script setup lang="ts">
  import { useGameStore } from "@/store/global-store";

  const gameStore = useGameStore();

  function checkAllFilteredGames() {
    gameStore.filterSortedGames.forEach((game) => (game.selected = true));
  }

  function uncheckAllFilteredGames() {
    gameStore.filterSortedGames.forEach((game) => (game.selected = false));
  }

  async function linkAllSelectedGames(link: boolean) {
    if (link) {
      gameStore.selectedGames.forEach((game) => game.link());
    } else {
      gameStore.selectedGames.forEach((game) => game.unlink());
    }
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

  function pushAlltoDBEditList() {
    gameStore.dbEditList.push(...gameStore.selectedGames);
  }

  async function deleteAllSelectedGames() {
    gameStore.selectedGames.forEach(async (game) => await game.deleteLocal());
  }
</script>

<template>
  <v-btn icon @contextmenu.prevent="uncheckAllFilteredGames">
    <v-icon icon="$mdiSelectMultiple" />
    <v-menu
      activator="parent"
      :close-on-content-click="false"
      scroll-strategy="close"
      transition="slide-y-transition"
      location="bottom center"
      origin="top center"
    >
      <v-sheet rounded="lg">
        <!-- Select, Unselect -->
        <v-btn-group>
          <v-btn @click="checkAllFilteredGames">
            <v-icon size="x-large">$mdiCheckboxMultipleMarked</v-icon>
          </v-btn>

          <v-btn @click="uncheckAllFilteredGames">
            <v-icon size="x-large">$mdiCheckboxMultipleBlankOutline</v-icon>
          </v-btn>
        </v-btn-group>

        <v-divider></v-divider>

        <v-btn-group class="grid3x2">
          <!-- Link, Unlink -->
          <v-btn
            :readonly="
              !(
                gameStore.selectedGames.length > 0 && //for not empty
                (gameStore.selectedGames.every((game) => !game.linked) || //for link
                  gameStore.selectedGames.every(
                    (game) => game.linked && game.inDatabase === 0 //for unlink
                  ))
              )
            "
            @click="
              linkAllSelectedGames(
                gameStore.selectedGames.every((game) => !game.linked)
              )
            "
          >
            <v-icon
              :color="
                !(
                  gameStore.selectedGames.length > 0 && //for not empty
                  (gameStore.selectedGames.every((game) => !game.linked) || //for link
                    gameStore.selectedGames.every(
                      (game) => game.linked && game.inDatabase === 0 //for unlink
                    ))
                )
                  ? 'grey'
                  : 'grey-darken-4'
              "
              :icon="
                gameStore.selectedGames.length === 0
                  ? '$mdiLinkVariant'
                  : gameStore.selectedGames.every((game) => !game.linked)
                  ? '$mdiLinkVariantPlus'
                  : gameStore.selectedGames.every(
                      (game) => game.linked && game.inDatabase === 0
                    )
                  ? '$mdiLinkVariantMinus'
                  : '$mdiLinkVariant'
              "
              size="x-large"
            ></v-icon>
          </v-btn>

          <!-- Add to DB -->
          <v-btn
            :readonly="
              gameStore.selectedGames.length === 0 ||
              gameStore.selectedGames.some((game) => !game.linked)
            "
            @click="pushAlltoDBEditList"
          >
            <v-icon
              :color="
                gameStore.selectedGames.length === 0 ||
                gameStore.selectedGames.some((game) => !game.linked)
                  ? 'grey'
                  : 'grey-darken-4'
              "
              size="x-large"
              >$mdiDatabaseEdit</v-icon
            >
          </v-btn>

          <!-- Download -->
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
              >$mdiCloudDownload</v-icon
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
                    <v-icon size="x-large">$mdiGamepadSquare</v-icon>
                  </v-btn>

                  <v-btn
                    @click="
                      pushAllToDownloadList(gameStore.config.value.gamesSDPath)
                    "
                  >
                    <v-icon size="x-large">$mdiMicroSd</v-icon>
                  </v-btn>

                  <!-- <v-btn
                    @click="
                      pushAllToDownloadList(gameStore.config.value.gamesUSBPath)
                    "
                  >
                    <v-icon size="x-large">$mdiUsb</v-icon>
                  </v-btn> -->
                </v-btn-group>
              </v-sheet>
            </v-menu>
          </v-btn>

          <!-- Move -->
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
                !(
                  gameStore.selectedGames.length > 0 &&
                  (gameStore.selectedGames.every((game) => game.inDeck) ||
                    gameStore.selectedGames.every((game) => game.inSDCard))
                )
                  ? 'grey'
                  : 'grey-darken-4'
              "
              size="x-large"
              >$mdiFolderMove
            </v-icon>
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
                    v-if="gameStore.selectedGames.every((game) => !game.inDeck)"
                    @click="
                      pushAllToDownloadList(
                        gameStore.config.value.gamesDataPath
                      )
                    "
                  >
                    <v-icon size="x-large">$mdiGamepadSquare</v-icon>
                  </v-btn>

                  <v-btn
                    v-if="
                      gameStore.selectedGames.every((game) => !game.inSDCard)
                    "
                    @click="
                      pushAllToDownloadList(gameStore.config.value.gamesSDPath)
                    "
                  >
                    <v-icon size="x-large">$mdiMicroSd</v-icon>
                  </v-btn>

                  <!-- <v-btn
                    @click="
                      pushAllToDownloadList(gameStore.config.value.gamesUSBPath)
                    "
                  >
                    <v-icon size="x-large">$mdiUsb</v-icon>
                  </v-btn> -->
                </v-btn-group>
              </v-sheet>
            </v-menu>
          </v-btn>

          <!-- Sync -->
          <v-btn
            :readonly="
              !(
                gameStore.selectedGames.length > 0 &&
                gameStore.selectedGames.every((game) => game.inNetDisk) &&
                (gameStore.selectedGames.every((game) => game.inSDCard) ||
                  gameStore.selectedGames.every((game) => game.inDeck))
              )
            "
            @click=""
          >
            <v-icon
              :color="
                !(
                  gameStore.selectedGames.length > 0 &&
                  gameStore.selectedGames.every((game) => game.inNetDisk) &&
                  (gameStore.selectedGames.every((game) => game.inSDCard) ||
                    gameStore.selectedGames.every((game) => game.inDeck))
                )
                  ? 'grey'
                  : 'grey-darken-4'
              "
              size="x-large"
              >$mdiSync</v-icon
            >
          </v-btn>

          <!-- Delete -->
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
              >$mdiDelete</v-icon
            >
            <v-dialog activator="parent" max-width="522">
              <template v-slot:default="{ isActive }">
                <v-card
                  prepend-icon="$mdiDeleteEmpty"
                  title="Free Local Storage"
                >
                  <v-container
                    max-height="200px"
                    class="text-center game-list-container py-0"
                  >
                    <v-card-subtitle v-for="game in gameStore.selectedGames">{{
                      game.gameName
                    }}</v-card-subtitle>
                  </v-container>
                  <v-card-text>
                    You're removing the games listed above from local storage.
                    This action is irreversible without a NetDisk backup.
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
        </v-btn-group>
      </v-sheet>
    </v-menu>
  </v-btn>
</template>

<style>
  .grid3x2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    /* 2 列 */
    height: 144px !important;
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
