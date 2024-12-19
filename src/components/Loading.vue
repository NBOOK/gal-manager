<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameListStore } from '@store/global'
import GameEntry from '@modules/GameEntry'

const gameListStore = useGameListStore()
const currentGame = ref<string>('')
const processedGames = ref<number>(0)
const totalGames = ref<number>(0)


async function scanGames() {
    const paths = {
        main: '/home/deck/Games/Gal',
        netDisk: '/run/media/deck/NetDisk/Games/Gal',
        sdCard: '/run/media/deck/SDCard/Games/Gal',
        deck: '/run/media/deck/Data/Games/Gal',
    };

    const entries = await Promise.all(
        Object.values(paths).map((path) =>
            window.ipcRenderer.invoke('scanDir', path)
        )
    );

    const [mainEntries, netDiskEntries, sdCardEntries, deckEntries] = entries.map((dirEntries) =>
        dirEntries.filter((entry: DirEntry) => entry.isDirectory)
    );

    const uniqueNames = new Set(
        [...mainEntries, ...netDiskEntries, ...sdCardEntries, ...deckEntries]
            .map((entry) => entry.name)
    );
    totalGames.value = uniqueNames.size;

    async function processEntries(
        entries: DirEntry[],
        pathKey: keyof typeof paths,
        flag: 'linked' | 'inNetDisk' | 'inSDCard' | 'inDeck'
    ) {
        const basePath = paths[pathKey];
        for (const entry of entries) {
            // console.log('Processing:', entry);
            if (!gameListStore.games[entry.name]) {
                currentGame.value = entry.name;
                gameListStore.games[entry.name] = await GameEntry.create(entry, basePath);
                processedGames.value++;
            }
            gameListStore.games[entry.name][flag] = true;
        }
    }

    await processEntries(mainEntries, 'main', 'linked')
    await processEntries(netDiskEntries, 'netDisk', 'inNetDisk')
    await processEntries(sdCardEntries, 'sdCard', 'inSDCard')
    await processEntries(deckEntries, 'deck', 'inDeck')

    console.log('Game list:', gameListStore.games);
    gameListStore.loading = false;
}



watch(() => gameListStore.loading,
    (newValue) => {
        if (newValue) {
            // clear the games list
            gameListStore.games = {}
            processedGames.value = 0
            scanGames()
        }
    }
)


</script>

<template>
    <div v-if="gameListStore.loading" class="overlay">
        <div class="loading-content">
            <p>{{ processedGames }}/{{ totalGames }}</p>
            <p>Processing: {{ currentGame }}</p>
            <progress :value="processedGames" :max="totalGames"></progress>
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
}
</style>