<script setup lang="ts">
import { computed, onMounted, ref, nextTick, reactive, onUnmounted, onUpdated } from 'vue'
import { useGameListStore } from '@store/global-store'

const gameListStore = useGameListStore()
const games = computed(() => gameListStore.games)
const totalGames = computed(() => gameListStore.totalGames)
const gameNameOverflows = reactive<Record<string, boolean>>({})
const gameNameRefs = reactive<Record<string, HTMLElement | null>>({}) // 用 ref 存储 DOM 引用

function formatTime(unixTime: number): string {
    const date = new Date(unixTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} Bytes`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes / 1024; // 转换为 KB
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
function isOverflow(element: HTMLElement): boolean {
    return element.scrollWidth > element.clientWidth;
}

function checkNameOverflows() {
    nextTick(() => {
        for (const gameName in gameNameRefs) {
            const element = gameNameRefs[gameName]
            if (element) {
                gameNameOverflows[gameName] = isOverflow(element);
            }
        }
    })
}


// 生命周期钩子
onMounted(() => {
    checkNameOverflows()
    window.addEventListener('resize', checkNameOverflows)
})

onUnmounted(() => {
    window.removeEventListener('resize', checkNameOverflows)
})

onUpdated(checkNameOverflows)
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
                    <div class="game-name-container" :ref="(el) => (gameNameRefs[game.gameName] = el as HTMLElement)">
                        <div class="game-name" :class="{ scrolled: gameNameOverflows[game.gameName] }">
                            {{ game.gameName }}
                        </div>
                    </div>
                    <div class="game-brand">{{ game.gameBrand }}</div>
                    <div class="game-name-en">{{ game.gameNameEN }}</div>
                    <div class="game-meta">{{ formatTime(game.modifiedTime) }}&nbsp&nbsp&nbsp&nbsp{{
                        formatSize(game.diskUsage) }}</div>
                    <!-- <div class="game-size">{{ formatSize(game.diskUsage) }}</div> -->
                </div>

                <!-- 右侧按钮 -->
                <div class="game-controls">
                    <button class="func-btns" v-if="game.linked" :style="{ backgroundColor: '#47D45A' }"
                        @click="game.unlink()">
                        <img src="/link2.svg" alt="Unlink" />
                    </button>
                    <button v-else class="func-btns" :style="{ backgroundColor: '#FF0000' }" @click="game.link()">
                        <img src="/link-unlink2.svg" alt="Link" />
                    </button>
                    <button class="func-btns" v-if="game.linked" :style="{ backgroundColor: '#47D45A' }"
                        @click="game.unlink()">
                        <img src="/link2.svg" alt="Unlink" />
                    </button>
                    <button v-else class="func-btns" :style="{ backgroundColor: '#FF0000' }" @click="game.link()">
                        <img src="/link-unlink2.svg" alt="Link" />
                    </button>
                    <button class="func-btns" v-if="game.linked" :style="{ backgroundColor: '#47D45A' }"
                        @click="game.unlink()">
                        <img src="/link2.svg" alt="Unlink" />
                    </button>
                    <button v-else class="func-btns" :style="{ backgroundColor: '#FF0000' }" @click="game.link()">
                        <img src="/link-unlink2.svg" alt="Link" />
                    </button>
                    <div class="break"></div>
                    <button class="func-btns" v-if="game.linked" :style="{ backgroundColor: '#47D45A' }"
                        @click="game.unlink()">
                        <img src="/link2.svg" alt="Unlink" />
                    </button>
                    <button v-else class="func-btns" :style="{ backgroundColor: '#FF0000' }" @click="game.link()">
                        <img src="/link-unlink2.svg" alt="Link" />
                    </button>
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

.game-item {
    display: flex;
    align-items: flex-start;
    border: 1px solid #ccc;
    border-radius: 5px;
    margin: 10px;
    padding: 10px;
}

.game-image {
    height: 100px;
}

.game-image img {
    height: 100px;
    object-fit: cover;
    border-radius: 5px;
    margin-right: 10px;
}

.game-details {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: calc(100% - 335px);
}


.game-brand,
.game-name-en,
.game-meta {
    font-size: 14px;
    color: #666;
}


/* 右侧按钮样式 */
.game-controls {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-self: flex-end;
    justify-content: space-evenly;
    gap: 5px;
    margin-left: 10px;
    width: 100px;
    margin-bottom: 10px;
}

.func-btns {
    width: 20px;
    height: 20px;
    /* border: none; */
    /* border-radius: 5px; */
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
    margin: 0;
}

.func-btns img {
    height: 100%;
}

.break {
    flex-basis: 100%;
    /* 强制当前行结束 */
    height: 0;
    /* 没有高度 */
}

.game-name-container {
    max-width: 100%;
    height: 32px;
    display: inline-flex;
    align-items: center;
    font-size: 16px;
    white-space: nowrap;
    overflow: hidden;
}

.game-name {
    display: inline-block;
    position: relative;
    text-overflow: clip;
    margin-right: 5px;
    margin-left: 5px;
}

.scrolled:hover {
    animation: scroll-rtl 10s linear infinite;
}

@keyframes scroll-rtl {
    from {
        transform: translate(0%);
    }

    to {
        transform: translate(-100%);
    }
}
</style>
