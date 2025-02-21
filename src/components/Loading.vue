<script setup lang="ts">
import { ref, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import GameEntry from "@/modules/GameEntry";
import pLimit from "p-limit";

const limit = pLimit(50);
const gameStore = useGameStore();
const currentGame = ref<string>("");
const processedGames = ref<number>(0);
const processedBuffer = ref<number>(0);
const totalGames = ref<number>(0);

async function processGameEntries(
  name: string,
  gameEntries: {
    dirEntry: DirEntry;
    flag: "linked" | "inDeck" | "inSDCard" | "inNetDisk";
  }[]
) {
  processedBuffer.value++;

  for (const { dirEntry, flag } of gameEntries) {
    if (!gameStore.games[name]) {
      gameStore.games[name] = new GameEntry();
      await gameStore.games[name].setup(dirEntry);
    }
    gameStore.games[name][flag] = true;
    if (flag === "linked") {
      const lastSlashIndex = dirEntry.symbolicTarget.lastIndexOf("/");
      const linkedBasePath = dirEntry.symbolicTarget.substring(
        0,
        lastSlashIndex
      );
      gameStore.games[dirEntry.name].linkedBasePath = linkedBasePath;
    }
  }

  if (gameStore.games[name].linked) {
    gameStore.games[name].refreshLink();
  }

  currentGame.value = name;
  processedGames.value++;
}

async function scanGames() {
  // let updateLock = Promise.resolve();
  const startTimestamp = Date.now();

  const paths = {
    gamesMainPath: gameStore.config.value.gamesMainPath,
    gamesDataPath: gameStore.config.value.gamesDataPath,
    gamesSDPath: gameStore.config.value.gamesSDPath,
    gamesExternalPath: gameStore.config.value.gamesExternalPath,
    // gamesAssetsPath: gameStore.config.value.gamesAssetsPath,
  };

  // scan all game directories in multiple paths
  const entries = (await Promise.all(
    Object.values(paths).map((path) =>
      window.ipcRenderer.invoke("scanDir", path)
    )
  )) as DirEntry[][];
  const [
    mainEntries,
    deckEntries,
    sdCardEntries,
    netDiskEntries,
    // assetsEntries,
  ] = entries.map((dirEntries) =>
    dirEntries.filter((entry: DirEntry) => entry.isDirectory)
  );

  // get unique game names
  const uniqueNames = new Set(
    [
      ...mainEntries,
      ...deckEntries,
      ...sdCardEntries,
      ...netDiskEntries,
      // ...assetsEntries,
    ].map((entry) => entry.name)
  );
  totalGames.value = uniqueNames.size;

  const gameEntriesMap: Record<
    string,
    {
      dirEntry: DirEntry;
      flag: "linked" | "inDeck" | "inSDCard" | "inNetDisk";
    }[]
  > = {};

  uniqueNames.forEach((name) => {
    gameEntriesMap[name] = [
      {
        dirEntry: mainEntries.find((entry) => entry.name === name),
        flag: "linked",
      },
      {
        dirEntry: deckEntries.find((entry) => entry.name === name),
        flag: "inDeck",
      },
      {
        dirEntry: sdCardEntries.find((entry) => entry.name === name),
        flag: "inSDCard",
      },
      {
        dirEntry: netDiskEntries.find((entry) => entry.name === name),
        flag: "inNetDisk",
      },
    ].filter((entry) => entry.dirEntry !== undefined) as {
      dirEntry: DirEntry;
      flag: "linked" | "inDeck" | "inSDCard" | "inNetDisk";
    }[];
  });

  console.log("Unique gameEntriesMap:", gameEntriesMap);

  const scannedTimestamp = Date.now();
  console.log("Game scan done in", scannedTimestamp - startTimestamp, "ms");

  await Promise.all(
    Object.entries(gameEntriesMap).map(([name, gameEntries]) =>
      limit(async () => await processGameEntries(name, gameEntries))
    )
  );

  // console.log("Game list:", gameStore.games);
  console.log("Game process done in", Date.now() - scannedTimestamp, "ms");

  gameStore.loading = false;
}

watch(
  () => gameStore.loading,
  (newValue) => {
    if (newValue) {
      // clear the games list
      for (const key in gameStore.games) {
        delete gameStore.games[key];
      }
      processedGames.value = 0;
      processedBuffer.value = 0;
      scanGames();
    }
  }
);
</script>

<template>
  <v-overlay
    v-model="gameStore.loading"
    no-click-animation
    persistent
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
  >
    <v-container width="80vw" max-height="100vh">
      <!-- <div v-if="processedGames === 0"> -->
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
        Scanning games...
      </div>
      <!-- </div> -->
      <div v-if="processedBuffer > 0">
        <div
          v-if="processedGames > 0"
          class="mb-5 text-center align-content-center text-h5 font-weight-bold"
          style="color: white; height: 100px"
        >
          {{ currentGame }}
        </div>
        <v-progress-linear
          height="10"
          color="white"
          buffer-color="grey-lighten-1"
          buffer-opacity="1"
          rounded
          stream
          :model-value="processedGames"
          :buffer-value="processedBuffer"
          :max="totalGames"
        ></v-progress-linear>
        <div
          class="mt-3 text-h5 text-center font-weight-medium"
          style="color: white"
        >
          {{ processedGames }} / {{ totalGames }}
        </div>
      </div>
    </v-container>
  </v-overlay>
</template>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-content {
  color: white;
  font-size: 1.5em;
  width: 90%;
}
</style>
