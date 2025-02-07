<script setup lang="ts">
import { ref, toRef, computed, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import pLimit from "p-limit";
import utils from "@/modules/utils";
import { DirSyncer, FileSyncer } from "@/modules/Synchronizer";

const limit = pLimit(50);
const gameStore = useGameStore();

// const overlay = computed({
//   get: () => gameStore.syncManager.managerOpen,
//   set: (value) => {
//     gameStore.syncManager.managerOpen = value;
//   },
// });
const overlay = toRef(gameStore.syncManager, "managerOpen");

const currentScanningGame = ref<string>("");
const scannedGames = ref<number>(0);
const scannedGamesBuffer = ref<number>(0);

const syncing = ref(false);
const abort = ref(false);

const syncedSize = ref(0);
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

// const currentSyncingGame = ref<string>("");
// const syncedGames = ref<number>(0);
const syncedFiles = ref<number>(0);

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
const behaviorIconDirection = (behavior: string | undefined) => {
  switch (behavior) {
    case "addR":
    case "updateR":
      return "$mdiArrowRightBold";
    case "addL":
    case "updateL":
      return "$mdiArrowLeftBold";
    case "deleteL":
    case "deleteR":
      return "$mdiDelete";
    case "skip":
    default:
      return "$mdiMinusThick";
  }
};

watch(
  () => gameStore.syncManager.gamesToSync.length > 0,
  async (newVal) => {
    if (newVal) {
      overlay.value = true;
    } else {
      cleanup();
      overlay.value = false;
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

// Syncing

const elapsedTime = ref(0);
const lastUpdateTime = ref(0);
const incrementSinceLastUpdate = ref(0);
const incrementsPerSec = ref<number[]>([]);
const avgIncrementPerSec = computed(() => {
  if (incrementsPerSec.value.length === 0) return 0;
  return (
    incrementsPerSec.value.reduce((acc, val) => acc + val, 0) /
    incrementsPerSec.value.length
  );
});
const remainingTime = computed(() => {
  return Math.max(
    Math.round(
      (totalSize.value - syncedSize.value) /
        Math.max(avgIncrementPerSec.value, 0.0001)
    ),
    0
  );
});
window.ipcRenderer.on("copy-progress", (_event, { increment }) => {
  if (!syncing.value) return;

  incrementSinceLastUpdate.value += increment;

  const currentTime = Date.now();
  if (lastUpdateTime.value === 0) lastUpdateTime.value = currentTime;

  // update
  if (currentTime - lastUpdateTime.value > 1000) {
    syncedSize.value += incrementSinceLastUpdate.value;
    currentSyncingFileSyncedSize.value += incrementSinceLastUpdate.value;
    gameStore.syncManager.progress = (syncedSize.value / totalSize.value) * 100;

    const incrementPerSec =
      (incrementSinceLastUpdate.value / (currentTime - lastUpdateTime.value)) *
      1000;

    incrementsPerSec.value.push(incrementPerSec);
    if (incrementsPerSec.value.length > 5) {
      incrementsPerSec.value.shift();
    }

    lastUpdateTime.value = currentTime;
    incrementSinceLastUpdate.value = 0;
  }
});

const currentFileSyncer = ref<FileSyncer | null>(null);
const currentSyncingFilePath = computed(() => {
  if (!currentFileSyncer.value) return "";
  return `${currentFileSyncer.value.baseFolderName}/${currentFileSyncer.value.relativePath}`;
});
const currentSyncingFileSize = computed(() => {
  if (!currentFileSyncer.value) return 0;
  if (currentFileSyncer.value.behavior.startsWith("delete")) return 0;
  if (currentFileSyncer.value.behavior.endsWith("R"))
    return currentFileSyncer.value.fileInfoL!.size;
  if (currentFileSyncer.value.behavior.endsWith("L"))
    return currentFileSyncer.value.fileInfoR!.size;
  return 0;
});
const currentSyncingFileSyncedSize = ref(0);
const currentSyncingFileProgress = computed(() => {
  if (currentSyncingFileSize.value === 0) return 0;
  return (
    (currentSyncingFileSyncedSize.value / currentSyncingFileSize.value) *
    100
  ).toFixed(1);
});
async function syncAll() {
  syncing.value = true;

  // put folder creation at the front, and deletion at the back
  const sortedFileSyncers = allFileSyncers.value.sort((a, b) => {
    const behaviorOrder = [
      "skip",
      "deleteR",
      "deleteL",
      "addR",
      "updateR",
      "addL",
      "updateL",
    ];
    const depth = (path: string) => path.split("/").length;

    // Helper function to determine if a FileSyncer should be at the front or back
    const isFrontDir = (fs: FileSyncer) =>
      fs.isDirectory && (fs.behavior === "addL" || fs.behavior === "addR");
    const isBackDir = (fs: FileSyncer) =>
      fs.isDirectory &&
      (fs.behavior === "deleteL" || fs.behavior === "deleteR");

    if (isFrontDir(a) && !isFrontDir(b)) return -1;
    if (!isFrontDir(a) && isFrontDir(b)) return 1;
    if (isBackDir(a) && !isBackDir(b)) return 1;
    if (!isBackDir(a) && isBackDir(b)) return -1;

    if (isFrontDir(a) && isFrontDir(b)) {
      return depth(a.relativePath) - depth(b.relativePath);
    }
    if (isBackDir(a) && isBackDir(b)) {
      return depth(b.relativePath) - depth(a.relativePath);
    }

    if (!a.isDirectory && !b.isDirectory) {
      const behaviorComparison =
        behaviorOrder.indexOf(a.behavior) - behaviorOrder.indexOf(b.behavior);
      if (behaviorComparison !== 0) return behaviorComparison;
    }

    return a.relativePath.localeCompare(b.relativePath);
  });

  console.log(sortedFileSyncers);

  const timer = setInterval(() => {
    elapsedTime.value++;
  }, 1000);

  for (const fileSyncer of sortedFileSyncers) {
    currentFileSyncer.value = fileSyncer;
    currentSyncingFileSyncedSize.value = 0;
    await fileSyncer.sync();
    syncedFiles.value++;
    if (abort.value) break;
  }
  // for (const syncManager of gameStore.syncManager.syncList) {
  //   currentSyncingGame.value = syncManager.dirName;
  //   await syncManager.syncAll();
  //   syncedGames.value++;
  //   if (abort.value) break;
  // }

  clearInterval(timer);

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
  abort.value = false;
  syncing.value = false;

  elapsedTime.value = 0;
  lastUpdateTime.value = 0;

  incrementSinceLastUpdate.value = 0;
  incrementsPerSec.value = [];

  syncedFiles.value = 0;
  syncedSize.value = 0;
  currentSyncingFileSyncedSize.value = 0;
  currentFileSyncer.value = null;

  currentScanningGame.value = "";
  scannedGames.value = 0;
  scannedGamesBuffer.value = 0;
  gameStore.syncManager.syncList = [];
  gameStore.syncManager.gamesToSync = [];

  gameStore.syncManager.progress = 0;
  overlay.value = false; // handled by watcher
}

const currentCursorPos = ref([0, 0] as [number, number]);
const dragging = ref(false);
const contextMenuOpen = ref(false);
function mouseDownHandler(event: MouseEvent, item: FileSyncer) {
  if (syncing.value) return;
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
        min-width="680px"
        height="95vh"
        rounded="lg"
        class="pa-8 d-flex flex-column"
      >
        <!-- Top summary btns -->
        <v-row
          class="justify-center flex-nowrap flex-grow-0 mb-1 text-medium-emphasis"
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
                @mousedown="mouseDownHandler($event, item)"
                @mouseup="dragging = false"
                @mouseenter="
                  item.selected = dragging ? !item.selected : item.selected
                "
                class="cursor-default overflow-hidden text-no-wrap flex-grow-1 d-flex mr-1"
              >
                <div class="sync-item" style="width: 55%">
                  <span class="sync-item-text">{{ item.baseFolderName }}</span>
                </div>
                <div class="sync-item" style="width: 20%">
                  <span class="sync-item-text">{{
                    item.parentFolderPath
                  }}</span>
                </div>
                <div class="sync-item" style="width: 25%">
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

              <v-btn
                icon
                tile
                variant="text"
                size="xs"
                color="grey-lighten-1"
                class="mr-1"
                @click="item.showInFolder()"
              >
                <v-icon
                  :icon="item.isDirectory ? '$mdiFolder' : '$mdiFile'"
                  size="xs"
                />
              </v-btn>
              <v-divider vertical></v-divider>

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
          <v-sheet v-show="syncing" class="mt-5">
            <v-row class="text-caption text-medium-emphasis ma-0 flex-nowrap">
              <v-progress-circular
                :model-value="currentSyncingFileProgress"
                :indeterminate="currentSyncingFileProgress === 0"
                width="2.5"
                size="16"
                color="grey-darken-1"
                class="inline-circular-progress mr-1 flex-shrink-0"
              >
                <v-icon size="10">{{
                  behaviorIconDirection(currentFileSyncer?.behavior)
                }}</v-icon>
              </v-progress-circular>
              <!-- <span>{{ currentSyncingFilePath }}</span> -->
              <span class="text-truncate mr-2">
                {{ currentSyncingFilePath }}
              </span>
              <v-spacer></v-spacer>
              <span class="flex-shrink-0">
                {{ utils.formatSize(currentSyncingFileSyncedSize) }}
                /
                {{ utils.formatSize(currentSyncingFileSize) }}
              </span>
              <!-- <span>&nbsp;({{ currentSyncingFileProgress }}%)</span> -->
            </v-row>
            <v-progress-linear
              :model-value="syncedSize"
              :max="totalSize"
              height="8"
              stream
              color="green"
            ></v-progress-linear>
            <!-- {{ utils.formatSize(syncedSize) }} /
            {{ utils.formatSize(totalSize) }}
            ・ in
            {{ utils.formatTime(remainingTime) }} -->
            <v-row
              class="text-caption text-medium-emphasis ma-0 justify-space-between position-relative"
            >
              <span>
                {{ syncedFiles }} files ({{ utils.formatSize(syncedSize) }}) ・
                {{ utils.formatTime(elapsedTime, "short") }}
              </span>
              <span
                class="text-center position-absolute"
                style="left: 50%; transform: translateX(-50%)"
              >
                {{ utils.formatSize(avgIncrementPerSec) }}/s
              </span>
              <span>
                {{ allFileSyncers.length - syncedFiles }} files ({{
                  utils.formatSize(totalSize - syncedSize)
                }}) ・
                {{ utils.formatTime(remainingTime, "short") }}
              </span>
            </v-row>
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
            prepend-icon="$mdiAutorenew"
            :loading="syncing"
            :color="abort ? 'red' : 'green'"
            @click="syncAll"
            class="flex-grow-1 ml-3"
            >Sync Changes</v-btn
          >
          <v-btn
            variant="outlined"
            icon
            rounded
            height="36"
            width="36"
            color="grey"
            @click="overlay = false"
            class="flex-grow-0 mx-3"
          >
            <v-icon icon="$mdiPageLast" style="transform: rotate(90deg)" />
          </v-btn>
        </v-row>
      </v-sheet>
      <v-menu v-model="contextMenuOpen" :target="currentCursorPos">
        <v-list slim>
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
                  allFileSyncers.forEach((fileSyncer) => {
                    fileSyncer.selected = false;
                    fileSyncer.selected = false;
                  })
              "
            ></v-btn>
          </v-btn-group>
          <v-list-subheader>Set Strategy</v-list-subheader>
          <v-list-item
            prepend-icon="$mdiArrowRightBold"
            value="l2r"
            @click="
              selectedFileSyncers.forEach((fileSyncer) => {
                fileSyncer.strategy = 'l2r';
                fileSyncer.selected = false;
              })
            "
          >
            Left to Right
          </v-list-item>
          <v-list-item
            prepend-icon="$mdiArrowLeftBold"
            value="r2l"
            @click="
              selectedFileSyncers.forEach((fileSyncer) => {
                fileSyncer.strategy = 'r2l';
                fileSyncer.selected = false;
              })
            "
          >
            Right to Left
          </v-list-item>
          <v-list-item
            prepend-icon="$mdiMinusThick"
            value="skip"
            @click="
              selectedFileSyncers.forEach((fileSyncer) => {
                fileSyncer.strategy = 'skip';
                fileSyncer.selected = false;
              })
            "
          >
            Exclude
          </v-list-item>
          <v-list-item
            prepend-icon="$mdiUpdate"
            value="newest"
            @click="
              selectedFileSyncers.forEach((fileSyncer) => {
                fileSyncer.strategy = 'newest';
                fileSyncer.selected = false;
              })
            "
          >
            Newest
          </v-list-item>

          <!-- Open folders -->
          <v-divider v-if="selectedFileSyncers.length === 1" />
          <v-list-item
            prepend-icon="$mdiFolderOpen"
            v-if="selectedFileSyncers.length === 1"
            @click="selectedFileSyncers[0].showInFolder()"
          >
            Show in Explorer
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

.inline-circular-progress {
  height: auto !important;
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
