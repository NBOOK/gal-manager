<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import utils from "@/modules/utils";
import CloudIcon from "@/icons/CloudIcon.vue";
import GamePadIcon from "@/icons/GamePadIcon.vue";
import SDCardIcon from "@/icons/SDCardIcon.vue";
// import USBIcon from "@/icons/USBIcon.vue";

const gameStore = useGameStore();

const deckDiskUsage = ref(0);
const sdCardDiskUsage = ref(0);
const netDiskUsage = ref(0);

async function getDiskUsage() {
  deckDiskUsage.value =
    (await window.ipcRenderer.invoke(
      "getDiskUsage",
      gameStore.config.value.gamesDataPath
    )) | 0;
  sdCardDiskUsage.value =
    (await window.ipcRenderer.invoke(
      "getDiskUsage",
      gameStore.config.value.gamesSDPath
    )) | 0;
  netDiskUsage.value = gameStore.netDiskOnline
    ? (await window.ipcRenderer.invoke(
        "getDiskUsage",
        gameStore.config.value.gamesNetPath
      )) | 0
    : 0;
}

onMounted(async () => {
  await getDiskUsage();
});

watch(
  () => gameStore.needDiskUsageRefresh,
  async (newVal) => {
    if (newVal) {
      await getDiskUsage();
      gameStore.needDiskUsageRefresh = false;
    }
  }
);
</script>

<template>
  <v-container>
    <v-app-bar
      flat
      density="compact"
      location="bottom"
      height="40"
      style="border-top: #aaaaaa solid 1px; font-size: 14px"
    >
      <template v-slot:prepend>
        <CloudIcon :fillPercentage="netDiskUsage / 100" class="storage-icon" />
        <span class="ml-1 mr-3 text-truncate">
          {{
            Object.values(gameStore.games).filter((game) => game.inNetDisk)
              .length
          }}
          games
        </span>
        <GamePadIcon
          :fillPercentage="deckDiskUsage / 100"
          class="storage-icon"
        />
        <span class="ml-1 mr-3 text-truncate">
          {{
            Object.values(gameStore.games).filter((game) => game.inDeck).length
          }}
          games
        </span>
        <SDCardIcon
          :fillPercentage="sdCardDiskUsage / 100"
          class="storage-icon"
        />
        <span class="ml-1 mr-3 text-truncate">
          {{
            Object.values(gameStore.games).filter((game) => game.inSDCard)
              .length
          }}
          games
        </span>
        <!-- <USBIcon :fillPercentage="1" class="storage-icon" /> -->
      </template>

      <!-- <v-app-bar-title>Application Bar</v-app-bar-title> -->

      <template v-slot:append>
        <!-- <v-btn icon="$mdiMagnify"></v-btn> -->
        <v-row
          v-if="Object.values(gameStore.selectedGames).length > 0"
          class="ma-0 text-truncate"
        >
          {{ gameStore.selectedGames.length }}
          {{ gameStore.selectedGames.length > 1 ? "games" : "game" }} selected
          ({{
            utils.formatSize(
              gameStore.selectedGames.reduce(
                (acc, game) => acc + game.diskUsage,
                0
              )
            )
          }})
        </v-row>
      </template>
    </v-app-bar>
  </v-container>
</template>

<style scoped>
.storage-icon {
  color: #212121;
  height: 16px;
}
</style>
