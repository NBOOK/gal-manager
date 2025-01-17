<script setup lang="ts">
import { ref, watch } from "vue";
import { useGameListStore } from "@store/global-store";
import GameEntry from "@modules/GameEntry";

const gameListStore = useGameListStore();
const currentGame = ref<string>("");
const processedGames = ref<number>(0);
const totalGames = ref<number>(0);

async function scanGames() {
  const paths = {
    main: "/home/deck/Games/Gal",
    deck: "/run/media/deck/Data/Games/Gal",
    sdCard: "/run/media/deck/SDCard/Games/Gal",
    netDisk: "/run/media/deck/NetDisk/Games/Gal",
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
    // use first 50 entries for demo
    const batchTasks = entries.slice(0, 10).map(async (entry) => {
      if (!gameListStore.games[entry.name]) {
        // console.log('Game entry:', entry.name, 'processing');
        gameListStore.games[entry.name] = await GameEntry.create(entry);
        // console.log('Game entry:', entry.name, 'done');
        await (updateLock = updateLock.then(() => {
          currentGame.value = entry.name;
          processedGames.value++;
        }));
      }
      gameListStore.games[entry.name][flag] = true;
      if (flag === "linked") {
        gameListStore.games[entry.name].linkedPath = entry.symbolicTarget;
      }
    });

    await Promise.all(batchTasks);
  }
  await processEntries(mainEntries, "linked");
  await processEntries(deckEntries, "inDeck");
  await processEntries(sdCardEntries, "inSDCard");
  await processEntries(netDiskEntries, "inNetDisk");

  console.log("Game list:", gameListStore.games);
  gameListStore.loading = false;
}

watch(
  () => gameListStore.loading,
  (newValue) => {
    if (newValue) {
      // clear the games list
      for (const key in gameListStore.games) {
        delete gameListStore.games[key];
      }
      processedGames.value = 0;
      scanGames();
    }
  }
);
</script>

<template>
  <div v-if="gameListStore.loading" class="overlay">
    <div class="loading-content">
      <p>{{ processedGames }}/{{ totalGames }}</p>
      <p>Processing: {{ currentGame }}</p>
      <progress :value="processedGames" :max="totalGames"></progress>
      <v-progress-linear
        :model-value="processedGames"
        :max="totalGames"
      ></v-progress-linear>
    </div>
  </div>
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
