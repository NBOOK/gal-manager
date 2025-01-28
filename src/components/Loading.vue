<script setup lang="ts">
import { ref, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import GameEntry from "@/modules/GameEntry";

const gameStore = useGameStore();
const currentGame = ref<string>("");
const processedGames = ref<number>(0);
const processedBuffer = ref<number>(0);
const totalGames = ref<number>(0);

async function scanGames() {
  const paths = {
    main: gameStore.config.value.gamesMainPath,
    deck: gameStore.config.value.gamesDataPath,
    sdCard: gameStore.config.value.gamesSDPath,
    netDisk: gameStore.config.value.gamesNetPath,
  };

  // scan all game directories in multiple paths
  const entries = await Promise.all(
    Object.values(paths).map((path) =>
      window.ipcRenderer.invoke("scanDir", path)
    )
  );
  const [mainEntries, deckEntries, sdCardEntries, netDiskEntries] = entries.map(
    (dirEntries) => dirEntries.filter((entry: DirEntry) => entry.isDirectory)
  );

  // get unique game names
  const uniqueNames = new Set(
    [...mainEntries, ...deckEntries, ...sdCardEntries, ...netDiskEntries].map(
      (entry) => entry.name
    )
  );
  totalGames.value = uniqueNames.size;

  // process each unique game entry and assign flags

  let updateLock = Promise.resolve();
  async function processEntries(
    entries: DirEntry[],
    // pathKey: keyof typeof paths,
    flag: "linked" | "inDeck" | "inSDCard" | "inNetDisk"
  ) {
    const batchTasks = entries.map(async (entry) => {
      //.slice(0, 10)
      if (!gameStore.games[entry.name]) {
        processedBuffer.value++;
        // console.log('Game entry:', entry.name, 'processing');
        gameStore.games[entry.name] = new GameEntry();
        await gameStore.games[entry.name].setup(entry);
        // console.log('Game entry:', entry.name, 'done');
        await (updateLock = updateLock.then(() => {
          currentGame.value = entry.name;
          processedGames.value++;
        }));
      }
      gameStore.games[entry.name][flag] = true;
      if (flag === "linked") {
        gameStore.games[entry.name].linkedPath = entry.symbolicTarget;
      }
    });

    await Promise.all(batchTasks);
  }
  await processEntries(mainEntries, "linked");
  await processEntries(deckEntries, "inDeck");
  await processEntries(sdCardEntries, "inSDCard");
  await processEntries(netDiskEntries, "inNetDisk");

  // console.log("Game list:", gameStore.games);
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
    <v-container width="100vw" max-height="100vh">
      <div v-if="processedGames === 0">
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
      </div>
      <div v-if="processedGames > 0">
        <div
          class="mb-5 text-center align-content-center text-h5 font-weight-bold"
          style="color: white; height: 100px"
        >
          {{ currentGame }}
        </div>
        <v-progress-linear
          height="10"
          color="white"
          buffer-color="green-lighten-3"
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
