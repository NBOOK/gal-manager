<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import pLimit from "p-limit";
import GameEntry from "@/modules/GameEntry";
import utils from "@/modules/utils";
import { DirSyncer, FileSyncer } from "@/modules/Synchronizer";

const limit = pLimit(50);
const gameStore = useGameStore();

const overlay = ref(false);
const currentScanningGame = ref<string>("");
const scannedGames = ref<number>(0);
const scannedGamesBuffer = ref<number>(0);
const currentSyncingGame = ref<string>("");
const syncedGames = ref<number>(0);

const copiedSize = ref(0);
const totalCopySize = computed(() => {
  return gameStore.syncManager.syncList.reduce((accDir, dirSyncer) => {
    return (
      accDir +
      dirSyncer.fileSyncers.reduce((accFile, fileSyncer) => {
        if (fileSyncer.behavior.startsWith("delete"))
          // no file copy here
          return accFile;
        else if (fileSyncer.behavior.endsWith("R"))
          // from left to right
          return accFile + fileSyncer.fileInfoL!.size;
        else if (fileSyncer.behavior.endsWith("L"))
          // from right to left
          return accFile + fileSyncer.fileInfoR!.size;
        else return accFile; // should not reach here, but just in case
      }, 0)
    );
  }, 0);
});

const allFileSyncers = computed(() => {
  // merge all fileSyncers from all dirSyncers
  return gameStore.syncManager.syncList.reduce((fileSyncers, dirSyncer) => {
    return fileSyncers.concat(dirSyncer.fileSyncers as FileSyncer[]);
  }, [] as FileSyncer[]);
});

const totalFilesToSync = computed(() => allFileSyncers.value.length);
const totalFilesToAddRight = computed(
  () =>
    allFileSyncers.value.filter((fileSyncer) => fileSyncer.behavior === "addR")
      .length
);
const totalFilesToUpdateRight = computed(
  () =>
    allFileSyncers.value.filter(
      (fileSyncer) => fileSyncer.behavior === "updateR"
    ).length
);
const totalFilesToDeleteRight = computed(
  () =>
    allFileSyncers.value.filter(
      (fileSyncer) => fileSyncer.behavior === "deleteR"
    ).length
);
const totalFilesToAddLeft = computed(
  () =>
    allFileSyncers.value.filter((fileSyncer) => fileSyncer.behavior === "addL")
      .length
);
const totalFilesToUpdateLeft = computed(
  () =>
    allFileSyncers.value.filter(
      (fileSyncer) => fileSyncer.behavior === "updateL"
    ).length
);
const totalFilesToDeleteLeft = computed(
  () =>
    allFileSyncers.value.filter(
      (fileSyncer) => fileSyncer.behavior === "deleteL"
    ).length
);

const checkTime = ref(0);

watch(
  () => gameStore.syncManager.gamesToSync.length > 0,
  async (newVal) => {
    overlay.value = newVal;
    if (!newVal) return;

    checkTime.value = Date.now();
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
    checkTime.value = Date.now() - checkTime.value;

    const validSyncManagers = syncManagers.filter(
      (manager) => manager && manager?.fileSyncers.length > 0
    ) as DirSyncer[];

    if (validSyncManagers.length > 0) {
      gameStore.syncManager.syncList.push(...validSyncManagers);
    }
  }
);

watch(
  () => gameStore.syncManager.syncList.length > 0,
  async (newVal) => {
    overlay.value = newVal;
  }
);

async function syncAll() {
  //   for (const syncManager of gameStore.syncManager.syncList) {
  //     currentSyncingGame.value = syncManager.dirName;
  //     await syncManager.syncAll();
  //     syncedGames.value++;
  //   }

  gameStore.syncManager.gamesToSync = [];
  currentScanningGame.value = "";
  scannedGames.value = 0;
  scannedGamesBuffer.value = 0;

  gameStore.syncManager.syncList = [];
  currentSyncingGame.value = "";
  syncedGames.value = 0;

  copiedSize.value = 0;
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
      <div v-if="scannedGames > 0">
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
          :max="gameStore.syncManager.gamesToSync.length"
        ></v-progress-linear>
        <div
          class="mt-3 text-h5 text-center font-weight-medium"
          style="color: white"
        >
          {{ scannedGames }} / {{ gameStore.syncManager.gamesToSync.length }}
        </div>
      </div>
    </v-container>

    <!-- Syncing container -->
    <v-container
      v-if="gameStore.syncManager.syncList.length > 0"
      width="100vw"
      max-height="100%"
    >
      <v-sheet
        width="100%"
        min-width="630px"
        height="95vh"
        rounded="lg"
        class="pa-8 d-flex flex-column"
      >
        <!-- Top summary btns -->
        <v-row class="justify-center flex-nowrap">
          <v-btn
            stacked
            density="compact"
            color="red-lighten-5"
            class="sync-indicator"
          >
            <template #prepend>
              <v-icon color="indigo" icon="$mdiDelete" />
            </template>
            {{ totalFilesToDeleteLeft }}
          </v-btn>
          <v-btn
            stacked
            density="compact"
            color="light-blue-lighten-5"
            class="sync-indicator"
          >
            <template #prepend>
              <v-icon color="indigo" icon="$mdiPencil" />
            </template>
            {{ totalFilesToUpdateLeft }}
          </v-btn>
          <v-btn
            stacked
            density="compact"
            color="green-lighten-5"
            class="sync-indicator"
          >
            <template #prepend>
              <v-icon color="indigo" icon="$mdiPlusThick" />
            </template>
            {{ totalFilesToAddLeft }}
          </v-btn>

          <v-btn
            prepend-icon="$mdiChartPie"
            density="compact"
            stacked
            variant="text"
            width="115px"
            readonly
          >
            {{ utils.formatSize(totalCopySize) }}
            <!-- 177.42 MB -->
          </v-btn>

          <v-btn
            stacked
            density="compact"
            color="green-lighten-5"
            class="sync-indicator"
          >
            <template #prepend>
              <v-icon color="amber-darken-2" icon="$mdiPlusThick" />
            </template>
            {{ totalFilesToAddRight }}
          </v-btn>
          <v-btn
            stacked
            density="compact"
            color="light-blue-lighten-5"
            class="sync-indicator"
          >
            <template #prepend>
              <v-icon color="amber-darken-2" icon="$mdiPencil" />
            </template>
            {{ totalFilesToUpdateRight }}
          </v-btn>
          <v-btn
            stacked
            density="compact"
            color="red-lighten-5"
            class="sync-indicator"
          >
            <template #prepend>
              <v-icon color="amber-darken-2" icon="$mdiDelete" />
            </template>
            {{ totalFilesToDeleteRight }}
          </v-btn>
        </v-row>

        <v-virtual-scroll :items="allFileSyncers" class="mt-6 pt-1">
          <template v-slot:default="{ item, index }">
            <v-row :index="index" class="flex-nowrap ma-0">
              <div class="sync-item" style="width: 50%">
                <span class="sync-item-text">{{ item.baseFolderName }}</span>
              </div>
              <div class="sync-item" style="width: 20%">
                <span class="sync-item-text">{{ item.parentFolderPath }}</span>
              </div>
              <div class="sync-item" style="width: 20%">
                <span class="sync-item-text">{{ item.fileName }}</span>
              </div>
              <v-btn density="compact">Change</v-btn>
              <!-- <v-list-item>{{ item.relativePath }}</v-list-item> -->
            </v-row>
          </template>
        </v-virtual-scroll>

        <v-btn @click="syncAll">Sync</v-btn>
        {{
          gameStore.syncManager.syncList.reduce(
            (acc, val) => acc + val.fileSyncers.length,
            0
          )
        }}
        files to sync detected in {{ checkTime }}ms
      </v-sheet>
    </v-container>
  </v-overlay>
</template>

<style scoped>
.sync-indicator {
  width: 50px;
  margin-left: 5px;
  margin-right: 5px;
}

.sync-item {
  direction: rtl;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* margin: 0, 5px, 0, 0 !important; */
  /* margin: 4px;
  padding: 4px; */
  /* height: 40px; */
  margin-right: 8px;
  /* width: 33%; */
}

.sync-item-text {
  unicode-bidi: plaintext;
}

.v-virtual-scroll {
  padding-top: 18px;
  padding-right: calc(1em - 10px);
  /* position: relative; */
  overflow-y: scroll !important;
}

.v-virtual-scroll::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.v-virtual-scroll::-webkit-scrollbar-track {
  /* background: transparent; */
  background: #f0f0f0;
}
.v-virtual-scroll::-webkit-scrollbar-track:hover {
  background: #f0f0f0;
}

.v-virtual-scroll::-webkit-scrollbar-thumb {
  background-color: #cccccc;
  border-radius: 10px;
}

.v-virtual-scroll::-webkit-scrollbar-thumb:hover {
  background-color: #888888;
}
</style>
