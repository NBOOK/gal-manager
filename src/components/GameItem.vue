<script setup lang="ts">
import { reactive } from "vue";
// import { useGameListStore } from '@store/global-store'
import GameEntry from "@modules/GameEntry";

defineProps<{ game: GameEntry }>(); // use props.game to access the game object

const overflowStates = reactive<Record<string, boolean>>({});

function formatTime(unixTime: number): string {
  const date = new Date(unixTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Bytes`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024; // 转换为 KB
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
function isOverflow(element: HTMLElement | null): boolean {
  if (!element) return false;
  return element.scrollWidth > element.clientWidth;
}

const vOverflowDetector = {
  mounted(el: HTMLElement, binding: { value: string }) {
    const key = binding.value;
    if (!key) return;

    const updateState = () => {
      overflowStates[key] = isOverflow(el as HTMLElement);
    };

    // 创建 ResizeObserver
    const observer = new ResizeObserver(updateState);
    observer.observe(el as HTMLElement);

    // 初始化时检测
    updateState();

    // 在元素被销毁时取消观察
    el.__resizeObserver__ = observer;
  },
  unmounted(el: HTMLElement) {
    el.__resizeObserver__?.disconnect();
    delete el.__resizeObserver__;
  },
};
</script>

<template>
  <!-- <div class="game-item"> -->
  <v-sheet rounded="lg" elevation="3" style="margin: 5px 0" min-width="550px">
    <div class="item">
      <!-- <v-container>
        <v-row> -->
      <!-- 左侧图片 -->
      <v-col class="flex-grow-0 pa-0">
        <div class="game-image">
          <img
            :src="`file://${game.imageAssets.headerSDPath}`"
            alt="Game Image"
          />
        </div>
      </v-col>

      <!-- 中间内容 -->
      <div class="game-details">
        <div v-overflow-detector="'game-name'" class="scroll-container">
          <div
            class="game-name"
            :class="{ scrolled: overflowStates['game-name'] }"
          >
            {{ game.gameName }}
          </div>
        </div>
        <div v-overflow-detector="'game-name-en'" class="scroll-container">
          <div
            class="game-name-en"
            :class="{ scrolled: overflowStates['game-name-en'] }"
          >
            {{ game.gameNameEN }}
          </div>
        </div>
        <div class="game-brand">{{ game.gameBrand }}</div>
        <div class="game-meta">
          {{ formatTime(game.modifiedTime) }}&nbsp&nbsp&nbsp&nbsp{{
            formatSize(game.diskUsage)
          }}
        </div>
      </div>

      <!-- 右侧按钮 -->
      <div class="game-controls">
        <!-- Link Button -->
        <v-btn
          v-if="game.linked"
          icon
          size="x-small"
          variant="text"
          :readonly="game.inLutrisDB || game.inSteamDB"
          @click="game.unlink()"
        >
          <v-icon icon="mdi-link" color="green" size="x-large"></v-icon>
        </v-btn>
        <v-btn
          v-else
          icon="mdi-link-off"
          size="x-small"
          variant="text"
          @click="game.link()"
        >
          <v-icon icon="mdi-link-off" color="red" size="x-large"></v-icon>
        </v-btn>

        <!-- Database Button -->
        <v-btn
          v-if="!game.linked"
          icon
          size="x-small"
          variant="text"
          readonly
          @click="game.removeDB()"
        >
          <v-icon
            icon="mdi-database-alert"
            color="orange"
            size="large"
          ></v-icon>
        </v-btn>
        <v-btn
          v-else-if="game.inLutrisDB && game.inSteamDB"
          icon
          size="x-small"
          variant="text"
          @click="game.removeDB()"
        >
          <v-icon
            icon="mdi-database-check"
            color="green"
            size="x-large"
          ></v-icon>
        </v-btn>
        <v-btn
          v-else-if="game.inLutrisDB !== game.inSteamDB"
          icon
          size="x-small"
          variant="text"
          @click="game.addDB()"
        >
          <v-icon
            icon="mdi-database-alert"
            color="orange"
            size="large"
          ></v-icon>
        </v-btn>
        <v-btn v-else icon size="x-small" variant="text" @click="game.addDB()">
          <v-icon icon="mdi-database-remove" color="red" size="large"></v-icon>
        </v-btn>

        <!-- Image Button -->
        <v-btn
          v-if="game.imageAssets.assetsCount == 5"
          icon
          size="x-small"
          variant="text"
          readonly
        >
          <v-icon icon="mdi-image-check" color="green" size="x-large"></v-icon>
        </v-btn>
        <v-btn
          v-else-if="game.imageAssets.assetsCount > 0"
          icon="mdi-image"
          size="x-small"
          variant="text"
          readonly
        >
          <v-icon icon="mdi-image" color="orange" size="large"></v-icon>
        </v-btn>
        <v-btn v-else icon size="x-small" variant="text" readonly>
          <v-icon icon="mdi-image-remove" color="red" size="large"></v-icon>
        </v-btn>

        <!-- Cloud Button -->
        <v-btn
          v-if="game.inNetDisk && (game.inDeck || game.inSDCard)"
          icon
          size="x-small"
          variant="text"
          readonly
        >
          <v-icon icon="mdi-cloud" color="green" size="x-large"></v-icon>
        </v-btn>
        <v-btn
          v-else-if="game.inNetDisk && !(game.inDeck || game.inSDCard)"
          icon
          size="x-small"
          variant="text"
          @click="game.inDeck = true"
        >
          <v-icon
            icon="mdi-cloud-download"
            color="green"
            size="x-large"
          ></v-icon>
        </v-btn>
        <v-btn
          v-else-if="!game.inNetDisk && (game.inDeck || game.inSDCard)"
          icon
          size="x-small"
          variant="text"
        >
          <v-icon
            icon="mdi-cloud-upload"
            color="orange"
            size="x-large"
          ></v-icon>
        </v-btn>
        <v-btn v-else icon size="x-small" variant="text">
          <v-icon icon="mdi-cloud" color="blue-grey" size="x-large"></v-icon>
        </v-btn>

        <!-- Storage Button -->
        <v-hover>
          <template v-slot:default="{ isHovering, props }">
            <v-btn
              v-if="game.inSDCard"
              v-bind="props"
              icon
              size="x-small"
              variant="text"
            >
              <v-icon
                :icon="isHovering ? 'mdi-delete-empty' : 'mdi-micro-sd'"
                :color="isHovering ? 'red' : 'green'"
                size="x-large"
              ></v-icon>
            </v-btn>
            <v-btn
              v-else-if="game.inDeck"
              v-bind="props"
              icon
              size="x-small"
              variant="text"
            >
              <v-icon
                :icon="isHovering ? 'mdi-delete-empty' : 'mdi-monitor'"
                :color="isHovering ? 'red' : 'green'"
                size="x-large"
              ></v-icon>
            </v-btn>
            <v-btn v-else v-bind="props" icon size="x-small" variant="text">
              <v-icon
                icon="mdi-monitor"
                color="blue-grey"
                size="x-large"
              ></v-icon>
            </v-btn>
          </template>
        </v-hover>

        <!-- Move Button -->
        <v-btn
          v-if="game.inDeck || game.inSDCard"
          icon
          size="x-small"
          variant="text"
          :readonly="game.inDeck && game.inSDCard"
          @click="game.move()"
        >
          <v-icon
            icon="mdi-folder-move"
            color="blue-grey"
            size="x-large"
          ></v-icon>
        </v-btn>
      </div>
      <!-- </v-row>
      </v-container> -->
    </div>
  </v-sheet>
</template>

<style scoped>
.item {
  display: flex;
  align-items: flex-start;
  max-width: 100%;
  flex-wrap: nowrap;
}

.game-item {
  display: flex;
  align-items: flex-start;
  border: 1px solid #ccc;
  border-radius: 5px;
  margin: 10px;
  padding: 10px;
  max-width: 100%;
  /* background-color: white; */
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
  min-width: 180px;
  /* max-width: 100%; */
}

.game-name {
  /* display: inline-block; */
  /* position: relative;
  text-overflow: clip;
  margin-right: 5px;
  margin-left: 5px; */
  /* height: 32px; */
  font-size: 16px;
}

.game-brand,
.game-name-en,
.game-meta {
  font-size: 14px;
  color: #8a8a8a;
  max-width: 100%;
}

.scroll-container {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
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

/* 右侧按钮样式 */
.game-controls {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-self: flex-end;
  justify-content: space-evenly;
  /* gap: 5px; */
  margin-left: 10px;
  width: 100px;
  min-width: 100px;
  margin-bottom: 10px;
}

.func-btns {
  width: 20px;
  min-width: 20px;
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
</style>
