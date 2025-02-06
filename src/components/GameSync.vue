<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import pLimit from "p-limit";
import utils from "@/modules/utils";
import { DirSyncer, FileSyncer } from "@/modules/Synchronizer";

const limit = pLimit(50);
const gameStore = useGameStore();

const overlay = ref(false);
const currentScanningGame = ref<string>("");
const scannedGames = ref<number>(0);
const scannedGamesBuffer = ref<number>(0);
// const currentSyncingGame = ref<string>("");
// const syncedGames = ref<number>(0);

const syncing = ref(false);
const abort = ref(false);

const copiedSize = ref(0);
const totalSize = computed(() => {
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

const allDirSyncers = computed(() => {
  return gameStore.syncManager.syncList as DirSyncer[];
});
const allFileSyncers = computed(() => {
  // merge all fileSyncers from all dirSyncers
  return gameStore.syncManager.syncList.reduce((fileSyncers, dirSyncer) => {
    return fileSyncers.concat(dirSyncer.fileSyncers as FileSyncer[]);
  }, [] as FileSyncer[]);
});

const displayedBehaviors = ref([
  "addL",
  "updateL",
  "deleteL",
  "skip",
  "addR",
  "updateR",
  "deleteR",
]);
watch(
  () => displayedBehaviors.value,
  (newVal) => {
    if (newVal.length === 0)
      displayedBehaviors.value = [
        "addL",
        "updateL",
        "deleteL",
        "skip",
        "addR",
        "updateR",
        "deleteR",
      ];
    else if (newVal.length === 5)
      // change to the removed one
      displayedBehaviors.value = [
        "addL",
        "updateL",
        "deleteL",
        "addR",
        "updateR",
        "deleteR",
      ].filter((behavior) => !newVal.includes(behavior));
    else if (newVal.length === 2)
      displayedBehaviors.value = displayedBehaviors.value.slice(-1);
  }
);
const displayedFileSyncers = computed(() => {
  return allFileSyncers.value.filter((fileSyncer) =>
    displayedBehaviors.value.includes(fileSyncer.behavior)
  );
});
const selectedFileSyncers = computed(() => {
  return allFileSyncers.value.filter((fileSyncer) => fileSyncer.selected);
});

const fileCount = computed(() => {
  const counts = {
    addR: 0,
    updateR: 0,
    deleteR: 0,
    skip: 0,
    addL: 0,
    updateL: 0,
    deleteL: 0,
  };

  allFileSyncers.value.forEach((fileSyncer) => {
    if (counts.hasOwnProperty(fileSyncer.behavior)) {
      counts[fileSyncer.behavior as keyof typeof counts]++;
    }
  });

  return counts;
});

const behaviorBGColor = (behavior: string) => {
  switch (behavior) {
    case "addL":
    case "addR":
      return "green-lighten-5";
    case "updateL":
    case "updateR":
      return "light-blue-lighten-5";
    case "deleteL":
    case "deleteR":
      return "red-lighten-5";
    case "skip":
    default:
      return "grey-lighten-3";
  }
};
const behaviorIcon = (behavior: string) => {
  switch (behavior) {
    case "addL":
    case "addR":
      return "$mdiPlusThick";
    case "updateL":
    case "updateR":
      return "$mdiPencil";
    case "deleteL":
    case "deleteR":
      return "$mdiDelete";
    case "skip":
    default:
      return "$mdiMinusThick";
  }
};
const behaviorIconColor = (behavior: string) => {
  switch (behavior) {
    case "addL":
    case "updateL":
    case "deleteL":
      return "indigo";
    case "addR":
    case "updateR":
    case "deleteR":
      return "amber-darken-2";
    case "skip":
    default:
      return "grey-darken-3";
  }
};

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
    } else {
      cleanup();
    }
  }
);

watch(
  () => gameStore.syncManager.syncList.length > 0,
  async (newVal) => {
    overlay.value = newVal;
  }
);

const lastUpdateTime = ref(0);
const remainingTime = ref(0); // seconds
const incrementSinceLastUpdate = ref(0);
const incrementsPerMs = ref<number[]>([]);
window.ipcRenderer.on("copy-progress", (_event, { increment }) => {
  if (!syncing.value) return;

  incrementSinceLastUpdate.value += increment;

  const currentTime = Date.now();
  if (lastUpdateTime.value === 0) lastUpdateTime.value = currentTime;

  // update
  if (currentTime - lastUpdateTime.value > 1000) {
    copiedSize.value += incrementSinceLastUpdate.value;

    const incrementPerMs =
      incrementSinceLastUpdate.value / (currentTime - lastUpdateTime.value);

    incrementsPerMs.value.push(incrementPerMs);
    if (incrementsPerMs.value.length > 5) {
      incrementsPerMs.value.shift();
    }
    const avgIncrementPerMs =
      incrementsPerMs.value.reduce((acc, val) => acc + val, 0) /
      incrementsPerMs.value.length;

    remainingTime.value = Math.round(
      (totalSize.value - copiedSize.value) /
        Math.max(avgIncrementPerMs, 0.0001) /
        1000
    );
    if (remainingTime.value < 0) remainingTime.value = 0;
    lastUpdateTime.value = currentTime;
    incrementSinceLastUpdate.value = 0;
  }
});

async function syncAll() {
  syncing.value = true;
  const order = [
    "skip",
    "deleteR",
    "deleteL",
    "addR",
    "updateR",
    "addL",
    "updateL",
  ];
  const sortedFileSyncers = allFileSyncers.value.sort((a, b) => {
    return order.indexOf(a.behavior) - order.indexOf(b.behavior);
  });
  for (const fileSyncer of sortedFileSyncers) {
    // currentSyncingGame.value = fileSyncer.baseFolderName;
    await fileSyncer.sync();
    // syncedGames.value++;
    if (abort.value) break;
  }
  // for (const syncManager of gameStore.syncManager.syncList) {
  //   currentSyncingGame.value = syncManager.dirName;
  //   await syncManager.syncAll();
  //   syncedGames.value++;
  //   if (abort.value) break;
  // }

  cleanup();
}

function close() {
  if (syncing.value) {
    abort.value = true;
  } else {
    cleanup();
  }
}

function cleanup() {
  lastUpdateTime.value = 0;
  remainingTime.value = 0;
  incrementSinceLastUpdate.value = 0;
  incrementsPerMs.value = [];
  syncing.value = false;
  gameStore.syncManager.gamesToSync = [];
  currentScanningGame.value = "";
  scannedGames.value = 0;
  scannedGamesBuffer.value = 0;
  gameStore.syncManager.syncList = [];
  // currentSyncingGame.value = "";
  // syncedGames.value = 0;
  copiedSize.value = 0;
  abort.value = false;
  // overlay.value = false; // handled by watcher
}

const currentCursorPos = ref([0, 0] as [number, number]);
const dragging = ref(false);
const contextMenuOpen = ref(false);
function mouseDownHandler(event: MouseEvent, item: FileSyncer) {
  if (event.button === 0) {
    item.selected = !item.selected;
    dragging.value = true;
  }
  if (event.button === 2) {
    if (!item.selected) {
      item.selected = true;
    }
    currentCursorPos.value = [event.clientX, event.clientY];
    contextMenuOpen.value = true;
  }
  event.preventDefault();
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
        <v-row
          class="justify-center flex-nowrap flex-grow-0 mb-3 text-medium-emphasis"
        >
          <v-btn-toggle rounded="lg" multiple v-model="displayedBehaviors">
            <v-btn
              stacked
              density="compact"
              color="red-lighten-5"
              class="sync-indicator"
              value="deleteL"
            >
              <template #prepend>
                <v-icon color="indigo" icon="$mdiDelete" />
              </template>
              {{ fileCount.deleteL }}
            </v-btn>
            <v-btn
              stacked
              density="compact"
              color="light-blue-lighten-5"
              class="sync-indicator"
              value="updateL"
            >
              <template #prepend>
                <v-icon color="indigo" icon="$mdiPencil" />
              </template>
              {{ fileCount.updateL }}
            </v-btn>
            <v-btn
              stacked
              density="compact"
              color="green-lighten-5"
              class="sync-indicator"
              value="addL"
            >
              <template #prepend>
                <v-icon color="indigo" icon="$mdiPlusThick" />
              </template>
              {{ fileCount.addL }}
            </v-btn>

            <v-btn
              prepend-icon="$mdiChartPie"
              density="compact"
              stacked
              variant="text"
              width="115px"
              readonly
            >
              {{ utils.formatSize(totalSize) }}
              <!-- 177.42 MB -->
            </v-btn>

            <v-btn
              stacked
              density="compact"
              color="green-lighten-5"
              class="sync-indicator"
              value="addR"
            >
              <template #prepend>
                <v-icon color="amber-darken-2" icon="$mdiPlusThick" />
              </template>
              {{ fileCount.addR }}
            </v-btn>
            <v-btn
              stacked
              density="compact"
              color="light-blue-lighten-5"
              class="sync-indicator"
              value="updateR"
            >
              <template #prepend>
                <v-icon color="amber-darken-2" icon="$mdiPencil" />
              </template>
              {{ fileCount.updateR }}
            </v-btn>
            <v-btn
              stacked
              density="compact"
              color="red-lighten-5"
              class="sync-indicator"
              value="deleteR"
            >
              <template #prepend>
                <v-icon color="amber-darken-2" icon="$mdiDelete" />
              </template>
              {{ fileCount.deleteR }}
            </v-btn>
          </v-btn-toggle>
        </v-row>
        <p class="text-right text-caption text-medium-emphasis pr-3">
          {{
            selectedFileSyncers.length ? `${selectedFileSyncers.length} of` : ``
          }}
          {{
            `${allFileSyncers.length} file${
              allFileSyncers.length > 1 ? "s" : ""
            } from ${allDirSyncers.length} game${
              allDirSyncers.length > 1 ? "s" : ""
            }`
          }}
        </p>
        <v-divider></v-divider>

        <v-virtual-scroll :items="displayedFileSyncers" class="pt-0">
          <template v-slot:default="{ item, index }">
            <v-row
              :index="index"
              :key="item.baseFolderName + item.relativePath"
              class="flex-nowrap align-center justify-space-between ma-0"
              @mousedown="mouseDownHandler($event, item)"
              @mouseup="dragging = false"
              @mouseenter="
                item.selected = dragging ? !item.selected : item.selected
              "
            >
              <v-btn
                icon
                variant="text"
                size="xs"
                v-model="item.selected"
                @click="item.selected = !item.selected"
              >
                <v-icon size="xs">{{
                  item.selected
                    ? "$mdiCheckboxMarked"
                    : "$mdiCheckboxBlankOutline"
                }}</v-icon>
              </v-btn>
              <div
                class="cursor-default text-no-wrap flex-grow-1"
                style="max-width: calc(100% - 128px); margin-right: auto"
              >
                <div class="sync-item" style="width: 60%">
                  <span class="sync-item-text">{{ item.baseFolderName }}</span>
                </div>
                <div class="sync-item" style="width: 20%">
                  <span class="sync-item-text">{{
                    item.parentFolderPath
                  }}</span>
                </div>
                <div class="sync-item" style="width: 20%">
                  <span class="sync-item-text">{{ item.fileName }}</span>
                </div>
                <v-tooltip
                  activator="parent"
                  location="top"
                  open-delay="2000"
                  transition="fade-transition"
                  >{{ `${item.baseFolderName}/${item.relativePath}` }}
                </v-tooltip>
              </div>

              <!-- <v-spacer></v-spacer> -->

              <v-btn-toggle
                mandatory
                tile
                density="compact"
                :model-value="item.actualStrategy"
                style="height: 24px; flex-shrink: 0"
              >
                <v-btn
                  icon
                  value="r2l"
                  @click="item.strategy = 'r2l'"
                  :color="behaviorBGColor(item.behaviorOf('r2l'))"
                  :readonly="syncing"
                  class="behavior-toggle-btn"
                >
                  <v-icon
                    size="xs"
                    :icon="behaviorIcon(item.behaviorOf('r2l'))"
                    :color="behaviorIconColor(item.behaviorOf('r2l'))"
                  />
                </v-btn>
                <v-btn
                  icon
                  value="skip"
                  @click="item.strategy = 'skip'"
                  :color="behaviorBGColor('skip')"
                  :readonly="syncing"
                  class="behavior-toggle-btn"
                >
                  <v-icon
                    size="xs"
                    :icon="behaviorIcon(item.behaviorOf('skip'))"
                    :color="behaviorIconColor(item.behaviorOf('skip'))"
                  />
                </v-btn>
                <v-btn
                  icon
                  value="l2r"
                  @click="item.strategy = 'l2r'"
                  :color="behaviorBGColor(item.behaviorOf('l2r'))"
                  :readonly="syncing"
                  class="behavior-toggle-btn"
                >
                  <v-icon
                    size="xs"
                    :icon="behaviorIcon(item.behaviorOf('l2r'))"
                    :color="behaviorIconColor(item.behaviorOf('l2r'))"
                  />
                </v-btn>
              </v-btn-toggle>
            </v-row>
            <v-divider></v-divider>
          </template>
        </v-virtual-scroll>
        <v-divider></v-divider>

        <v-expand-transition>
          <v-sheet v-show="syncing" class="mt-5 text-center">
            <v-progress-linear
              :model-value="copiedSize"
              :max="totalSize"
              height="8"
              stream
              color="green"
            ></v-progress-linear>
            {{ utils.formatSize(copiedSize) }} /
            {{ utils.formatSize(totalSize) }}
            ・ in
            {{ utils.formatTime(remainingTime) }}
          </v-sheet>
        </v-expand-transition>
        <v-row class="mt-5 flex-grow-0">
          <v-btn
            class="ml-3"
            variant="outlined"
            color="red"
            prepend-icon="$mdiStop"
            @click="close"
            >Cancel</v-btn
          >
          <v-btn
            variant="outlined"
            prepend-icon="$mdiSync"
            :loading="syncing"
            color="green"
            @click="syncAll"
            class="flex-grow-1 mx-3"
            >Sync Changes</v-btn
          >
        </v-row>
      </v-sheet>
      <v-menu v-model="contextMenuOpen" :target="currentCursorPos">
        <v-list>
          <v-btn-group>
            <v-btn
              variant="text"
              icon="$mdiCheckboxMultipleMarked"
              @click="
                async () =>
                  allFileSyncers.forEach(
                    (fileSyncer) => (fileSyncer.selected = true)
                  )
              "
            >
            </v-btn>
            <v-btn
              variant="text"
              icon="$mdiCheckboxMultipleBlankOutline"
              @click="
                async () =>
                  allFileSyncers.forEach(
                    (fileSyncer) => (fileSyncer.selected = false)
                  )
              "
            ></v-btn>
          </v-btn-group>
          <v-list-subheader>Set Strategy</v-list-subheader>
          <v-list-item
            prepend-icon="$mdiArrowRightBold"
            value="l2r"
            @click="
              selectedFileSyncers.forEach(
                (fileSyncer) => (fileSyncer.strategy = 'l2r')
              )
            "
          >
            Left to Right
          </v-list-item>
          <v-list-item
            prepend-icon="$mdiArrowLeftBold"
            value="r2l"
            @click="
              selectedFileSyncers.forEach(
                (fileSyncer) => (fileSyncer.strategy = 'r2l')
              )
            "
          >
            Right to Left
          </v-list-item>
          <v-list-item
            prepend-icon="$mdiMinusThick"
            value="skip"
            @click="
              selectedFileSyncers.forEach(
                (fileSyncer) => (fileSyncer.strategy = 'skip')
              )
            "
          >
            Exclude
          </v-list-item>
          <v-list-item
            prepend-icon="$mdiUpdate"
            value="newest"
            @click="
              selectedFileSyncers.forEach(
                (fileSyncer) => (fileSyncer.strategy = 'newest')
              )
            "
          >
            Newest
          </v-list-item>
        </v-list>
      </v-menu>
    </v-container>
  </v-overlay>
</template>

<style scoped>
.sync-indicator {
  width: 50px;
  margin-left: 5px;
  margin-right: 5px;
  border-radius: 8px;
}

.sync-item {
  direction: rtl;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 12px;
  display: inline-block;
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

.behavior-toggle-btn {
  width: 24px;
}
</style>
