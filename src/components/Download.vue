<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import utils from "@/modules/utils";
// import GameEntry from "@/modules/GameEntry";
const gameStore = useGameStore();

const downloading = ref(false);

const lastUpdateTime = ref(0);
const remainingTime = ref(0); // seconds
const incrementSinceLastUpdate = ref(0);
const deltaProgressOfUpdates = ref<number[]>([]);

const totalSize = computed(() =>
  gameStore.downloadList.reduce((acc, item) => acc + item.game.diskUsage, 0)
);
const totalDownloadedSize = ref(0);
const currentIndex = ref(0);

const currentItem = computed(() => gameStore.downloadList[currentIndex.value]);
const currentGame = computed(() => currentItem.value?.game);

const pathIconMap: { [key: string]: string } = {
  [gameStore.config.value.gamesMainPath]: "$mdiHome",
  [gameStore.config.value.gamesDataPath]: "$mdiGamepadSquare",
  [gameStore.config.value.gamesSDPath]: "$mdiMicroSd",
  [gameStore.config.value.gamesUSBPath]: "$mdiUsb",
  [gameStore.config.value.gamesNetPath]: "$mdiCloud",
  [gameStore.config.value.gamesExternalPath]: "$mdiCloud",
};

window.ipcRenderer.on("copy-progress", (_event, { increment }) => {
  if (!downloading.value) return;

  incrementSinceLastUpdate.value += increment;

  const currentTime = Date.now();
  if (lastUpdateTime.value === 0) lastUpdateTime.value = currentTime;

  // update
  if (currentTime - lastUpdateTime.value > 1000) {
    totalDownloadedSize.value += incrementSinceLastUpdate.value;

    const deltaProgress =
      (incrementSinceLastUpdate.value / currentGame.value.diskUsage) * 100;
    currentItem.value.progress += deltaProgress;

    const deltaProgressPerMs =
      deltaProgress / (currentTime - lastUpdateTime.value);

    deltaProgressOfUpdates.value.push(deltaProgressPerMs);
    if (deltaProgressOfUpdates.value.length > 5) {
      deltaProgressOfUpdates.value.shift();
    }
    const avgDeltaProgressPerMs =
      deltaProgressOfUpdates.value.reduce((acc, val) => acc + val, 0) /
      deltaProgressOfUpdates.value.length;

    remainingTime.value = Math.round(
      (100 - currentItem.value.progress) /
        Math.max(avgDeltaProgressPerMs, 0.0001) /
        1000
    );
    if (remainingTime.value < 0) remainingTime.value = 0;
    lastUpdateTime.value = currentTime;
    incrementSinceLastUpdate.value = 0;
  }
});

async function downloadAll() {
  downloading.value = true;
  while (currentIndex.value < gameStore.downloadList.length) {
    console.log(
      "Downloading",
      currentIndex.value,
      currentItem.value.game.gameName
    );
    await currentItem.value.game.downloadTo(currentItem.value.target);

    currentItem.value.progress = 100; // sometimes the progress is not 100%
    lastUpdateTime.value = 0;
    remainingTime.value = 0;
    deltaProgressOfUpdates.value = [];
    console.log(
      "Downloaded",
      currentIndex.value,
      currentItem.value.game.gameName
    );
    currentIndex.value++;
  }
  downloading.value = false;

  //   totalSize.value = 0;
  totalDownloadedSize.value = 0;
  gameStore.downloadList = [];
  currentIndex.value = 0;
}

watch(
  () => gameStore.downloadList.length,
  (newVal, oldVal) => {
    console.log("downloadList changed", oldVal, newVal);
    if (oldVal === 0 && newVal > 0 && !downloading.value) {
      console.log("Call downloadAll()");
      downloadAll();
      gameStore.needDiskUsageRefresh = true;
    }
  }
);
</script>

<template>
  <v-progress-circular
    :width="gameStore.downloadList.length ? 3 : 3"
    :model-value="(totalDownloadedSize / totalSize) * 100"
  >
    <v-btn icon :readonly="gameStore.downloadList.length === 0">
      <v-icon
        v-if="gameStore.downloadList.length"
        size="small"
        icon="$mdiDownload"
      />
      <!-- <v-btn icon>
      <v-icon icon="$mdiDownload" /> -->
      <v-menu
        v-if="gameStore.downloadList.length"
        activator="parent"
        :close-on-content-click="false"
        scroll-strategy="close"
        transition="slide-y-transition"
        location="bottom center"
        origin="top center"
      >
        <v-list max-width="800" min-width="400" max-height="500">
          <!-- <div>Download List</div> -->
          <v-list-item
            v-for="(item, index) in gameStore.downloadList"
            :key="index"
            slim
            :prepend-icon="pathIconMap[item.source]"
            :append-icon="pathIconMap[item.target]"
          >
            <v-list-item-title>{{ item.game.gameName }}</v-list-item-title>
            <v-progress-linear
              :stream="currentGame.gameName !== item.game.gameName"
              :model-value="item.progress"
            ></v-progress-linear>
            <v-list-item-subtitle
              v-if="currentGame.gameName === item.game.gameName"
            >
              {{
                utils.formatSize((item.progress * item.game.diskUsage) / 100)
              }}
              /
              {{ utils.formatSize(item.game.diskUsage) }}
              ・ in
              {{ utils.formatTime(remainingTime, "short") }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-btn>
  </v-progress-circular>
</template>

<style scoped>
::-webkit-scrollbar {
  display: none;
}
</style>
