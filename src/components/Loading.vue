<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameListStore, useGameStore } from '../store/store'

const gameListStore = useGameListStore()
const currentGame = ref<string>('')
const processedGames = ref<number>(0)
const gameList = ref<string[]>([])



async function fetchSubdirectories(dirPath: string) {
    try {
        gameList.value = await window.ipcRenderer.invoke('listSubdirectories', dirPath);
    } catch (err) {
        console.error('Error reading directory:', err)
    } finally {
        await processSubdirectories()
    }
}


async function processSubdirectories() {
    let cnt = 0
    for (const subdir of gameList.value) {
        const gameStore = useGameStore()
        gameStore.folderName = subdir
        gameListStore.games.push(gameStore)
        currentGame.value = subdir
        processedGames.value++
        await new Promise(resolve => setTimeout(resolve, 25)) // sleep for 0.5s
        cnt += 1
        if (cnt === 100) {
            break
        }
    }
    gameListStore.loading = false;
    console.log('Loading set to:', gameListStore.loading); // 调试输出
}

watch(() => gameListStore.loading,
    (newValue) => {
        if (newValue) {
            fetchSubdirectories('/run/media/deck/NetDisk/Games/Gal') // 开始加载
        }
    }
)


</script>

<template>
    <div v-if="gameListStore.loading" class="overlay">
        <div class="loading-content">
            <p>{{ processedGames }}/{{ gameList.length }}</p>
            <p>Processing: {{ currentGame }}</p>
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