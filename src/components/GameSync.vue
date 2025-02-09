<script setup lang="ts">
import { ref, toRef, computed, watch, onMounted, onUnmounted } from "vue";
import { useGameStore } from "@/store/global-store";
import pLimit from "p-limit";
import { DirSyncer } from "@/modules/Synchronizer";
import SyncerCore from "@/components/SyncerCore.vue";

const limit = pLimit(50);
const gameStore = useGameStore();

const overlay = toRef(gameStore.syncManager, "managerOpen");
// const syncing = ref(false);
// const abort = ref(false);

const currentScanningGame = ref<string>("");
const scannedGames = ref<number>(0);
const scannedGamesBuffer = ref<number>(0);

onMounted(() => {
  console.log("GameSync mounted");
});
onUnmounted(() => {
  console.log("GameSync unmounted");
});

watch(
  () => gameStore.gamesToSync.length > 0,
  async (newVal) => {
    if (newVal) {
      overlay.value = true;
    } else {
      cleanup();
      overlay.value = false;
      return;
    }

    const syncManagers = await Promise.all(
      gameStore.selectedGames.map((game) =>
        limit(async () => {
          scannedGamesBuffer.value++;
          const syncManager = await game.getSyncManager();
          currentScanningGame.value = game.folderName;
          scannedGames.value++;
          return syncManager;
        })
      )
    );

    const validSyncManagers = syncManagers.filter(
      (manager) => manager && manager?.fileSyncers.length > 0
    ) as DirSyncer[];

    if (validSyncManagers.length > 0) {
      gameStore.syncManager.syncList.push(...validSyncManagers);
    } else {
      cleanup();
    }
  }
);

watch(
  () => gameStore.syncManager.syncList.length > 0,
  async (newVal) => {
    if (newVal) {
      overlay.value = true;
    } else {
      cleanup();
      overlay.value = false;
    }
  }
);

function cleanup() {
  console.log("Cleanup in GameSync Called");

  currentScanningGame.value = "";
  scannedGames.value = 0;
  scannedGamesBuffer.value = 0;
}
</script>

<template>
  <v-overlay
    v-model="overlay"
    persistent
    no-click-animation
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
  >
    <!-- Loading container -->
    <v-container
      v-if="gameStore.syncManager.syncList.length === 0"
      width="80vw"
      max-height="100vh"
    >
      <div>
        <div
          class="mb-5 text-center align-content-center text-h5 font-weight-bold"
        >
          <v-progress-circular
            indeterminate
            size="100"
            width="7"
            color="white"
            class="justify-center align-content-center"
          ></v-progress-circular>
        </div>
        <div
          class="text-center align-content-center text-h5 font-weight-bold"
          style="color: white"
        >
          Scanning differences...
        </div>
      </div>
      <div v-if="scannedGamesBuffer > 0">
        <div
          class="mb-5 text-center align-content-center text-h5 font-weight-bold"
          style="color: white; height: 100px"
        >
          {{ currentScanningGame }}
        </div>
        <v-progress-linear
          height="10"
          color="white"
          buffer-color="grey-lighten-1"
          buffer-opacity="1"
          rounded
          stream
          :model-value="scannedGames"
          :buffer-value="scannedGamesBuffer"
          :max="gameStore.gamesToSync.length"
        ></v-progress-linear>
        <div
          class="mt-3 text-h5 text-center font-weight-medium"
          style="color: white"
        >
          {{ scannedGames }} / {{ gameStore.gamesToSync.length }}
        </div>
      </div>
    </v-container>

    <SyncerCore :manager="gameStore.syncManager" />
  </v-overlay>
</template>

<style scoped></style>
