<script setup lang="ts">
import { computed } from 'vue'
import { useGameListStore } from '@store/global-store'

const gameListStore = useGameListStore()
const games = computed(() => gameListStore.games)
const totalGames = computed(() => gameListStore.totalGames)
</script>


<template>
    <div class="game-list-container">
        <div class="game-list" v-if="totalGames > 0">
            <div v-for="(game, key) in games" :key="key" class="game-item">
                {{ game.gameName }}
            </div>
        </div>
        <div v-else>
            No games available.
        </div>
    </div>
</template>

<style scoped>
.game-list-container {
    width: 100%;
    overflow-y: scroll;
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 5px;
    box-sizing: border-box;
}

.game-list {
    display: flex;
    flex-direction: column;
}

.game-item {
    padding: 5px;
    border-bottom: 1px solid #eee;
}

.game-item:last-child {
    border-bottom: none;
}
</style>
