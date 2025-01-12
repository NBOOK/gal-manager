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
                <!-- 左侧图片 -->
                <div class="game-image">
                    <img :src="`file://${game.imageAssets.headerSDPath}`" alt="Game Image" />
                </div>

                <!-- 中间内容 -->
                <div class="game-details">
                    <div class="game-name marquee">
                        <strong>{{ game.gameName }}</strong>
                    </div>
                    <div class="game-brand">{{ game.gameBrand }}</div>
                    <div class="game-name-en">{{ game.gameNameEN }}</div>
                    <div class="game-time">{{ game.modifiedTime }}</div>
                    <div class="game-size">{{ game.diskUsage }}</div>
                </div>

                <!-- 右侧按钮 -->
                <div class="game-controls">
                    <!-- 替代状态按钮 -->
                    <button class="placeholder-btn">Button 1</button>
                    <button class="placeholder-btn">Button 2</button>
                    <button class="placeholder-btn">Button 3</button>
                </div>
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

/* .game-item {
    padding: 5px;
    border-bottom: 1px solid #eee;
} */

.game-item {
    display: flex;
    align-items: center;
    border: 1px solid #ccc;
    border-radius: 5px;
    margin: 10px 0;
    padding: 10px;
}

.game-image img {
    /* width: 100px; */
    height: 100px;
    object-fit: cover;
    border-radius: 5px;
    margin-right: 10px;
}

.game-details {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.game-name {
    font-size: 16px;
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.marquee {
    overflow: hidden;
    position: relative;
    animation: marquee 5s linear infinite;
}

.game-brand,
.game-name-en,
.game-time,
.game-size {
    font-size: 14px;
    color: #666;
}

.game-item:last-child {
    border-bottom: none;
}

/* 右侧按钮样式 */
.game-controls {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-left: 10px;
}

.placeholder-btn {
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    padding: 5px;
    border-radius: 5px;
    cursor: pointer;
}

.placeholder-btn:hover {
    background-color: #e0e0e0;
}
</style>
